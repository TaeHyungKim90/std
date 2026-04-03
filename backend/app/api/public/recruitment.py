import logging
import os
from typing import Optional, cast

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from db.session import get_db
from models.recruitment_models import JobPosting, ResumeTemplate
from schemas.public import recruitment_schemas
from services import common_service
from services.public import recruitment_service as service
from services.public.applicant_auth import (
	get_applicant_jwt_payload_if_any,
	get_current_applicant,
	try_get_applicant_id,
)
from core.config import settings
from core.security import create_access_token, decode_auth_token

router = APIRouter()
logger = logging.getLogger(__name__)


def _applicant_id_from_session(current_applicant: dict) -> int:
	raw = current_applicant.get("applicantId")
	if raw is None:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 지원자 세션입니다.")
	try:
		return int(raw)
	except (TypeError, ValueError):
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 지원자 세션입니다.")


IS_PROD = settings.ENVIRONMENT == "production"
APPLICANT_COOKIE_OPTIONS = {
	"key": "applicantToken",
	"httponly": True,
	"max_age": settings.ACCESS_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
	"samesite": "lax",
	"secure": IS_PROD,
	"path": "/",
}

# 1. [공개] 진행 중인 채용 공고 리스트 조회 (페이징)
@router.get("/jobs", response_model=recruitment_schemas.JobPostingPublicListPage)
def get_public_jobs(
	request: Request,
	skip: int = Query(0, ge=0),
	limit: int = Query(20, ge=1, le=100),
	db: Session = Depends(get_db),
):
	"""현재 게시 중인 채용 공고를 페이징으로 가져옵니다. 지원자 쿠키가 있으면 마감된 공고 중 본인이 지원한 공고도 포함합니다."""
	try:
		applicant_id = try_get_applicant_id(request)
		return service.get_public_jobs(db, skip=skip, limit=limit, applicant_id=applicant_id)
	except Exception:
		logger.exception("Failed to get public jobs")
		raise HTTPException(status_code=500, detail="공고 조회 중 서버 오류가 발생했습니다.")


@router.get("/jobs/{job_id}/resume-template")
def download_job_resume_template(job_id: int, db: Session = Depends(get_db)):
	"""공고에 연결된 이력서 양식(.docx) 다운로드 (비로그인 허용)."""
	job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
	if not job or not job.resume_template_id:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="이력서 양식을 찾을 수 없습니다.")
	tpl = db.query(ResumeTemplate).filter(ResumeTemplate.id == job.resume_template_id).first()
	if not tpl:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="이력서 양식을 찾을 수 없습니다.")
	full_path = os.path.join(common_service.UPLOAD_DIR, cast(str, tpl.saved_name))
	if not os.path.isfile(full_path):
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="파일이 저장소에 없습니다.")
	safe_name = f"{cast(str, tpl.name).replace('/', '_')}.docx"
	return FileResponse(
		full_path,
		filename=safe_name,
		media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	)


@router.post("/upload-apply-files")
async def upload_application_files(
	resume: UploadFile = File(...),
	portfolio: Optional[UploadFile] = File(None),
	db: Session = Depends(get_db),
	current_applicant: dict = Depends(get_current_applicant),
):
	"""지원자 전용: 이력서(.docx) 및 선택 포트폴리오 업로드 후 URL 반환."""
	try:
		resume_url, portfolio_url = await service.upload_application_attachments(db, resume, portfolio)
		return {"resume_file_url": resume_url, "portfolio_file_url": portfolio_url}
	except ValueError as ve:
		raise HTTPException(status_code=400, detail=str(ve))
	except HTTPException:
		raise
	except Exception:
		logger.exception("upload-apply-files failed")
		raise HTTPException(status_code=500, detail="파일 업로드 중 서버 오류가 발생했습니다.")

# 2. [공개] 입사 지원서 제출
@router.post("/apply")
def submit_application(
	request: Request,
	data: recruitment_schemas.ApplicationCreate,
	db: Session = Depends(get_db),
):
	"""채용 공고에 지원서를 제출합니다. (중복 지원 체크 포함)"""
	try:
		# 운영(또는 설정)에서는 레거시 /apply 를 완전히 비활성화 권장
		if settings.ENVIRONMENT == "production" or not settings.ALLOW_LEGACY_PUBLIC_APPLY:
			raise HTTPException(
				status_code=410,
				detail="레거시 지원서 제출 엔드포인트(/apply)는 비활성화되었습니다. /apply/me를 사용해 주세요.",
			)

		# 지원자 쿠키 세션이 존재하면 신규 엔드포인트(/apply/me)만 사용하도록 강제
		token = request.cookies.get("applicantToken")
		if token:
			payload = decode_auth_token(token)
			if payload and payload.get("applicantId"):
				raise HTTPException(
					status_code=400,
					detail="로그인된 지원자는 /apply/me 엔드포인트를 사용해 주세요.",
				)
		return service.submit_application(db, data)
	except ValueError as ve:
		# 서비스에서 발생한 '이미 지원함' 등의 비즈니스 예외 처리
		db.rollback()
		raise HTTPException(status_code=400, detail=str(ve))
	except HTTPException:
		raise
	except Exception:
		db.rollback()
		logger.exception("Failed to submit application (legacy)")
		raise HTTPException(status_code=500, detail="지원서 제출 중 서버 오류가 발생했습니다.")


# 2-1. [지원자] (쿠키 세션) 입사 지원서 제출
@router.post("/apply/me")
def submit_application_me(
	data: recruitment_schemas.ApplicationCreateAuthenticated,
	db: Session = Depends(get_db),
	current_applicant: dict = Depends(get_current_applicant),
):
	try:
		return service.submit_application_authenticated(
			db,
			applicant_id=_applicant_id_from_session(current_applicant),
			data=data,
		)
	except ValueError as ve:
		db.rollback()
		raise HTTPException(status_code=400, detail=str(ve))
	except HTTPException:
		raise
	except Exception:
		db.rollback()
		logger.exception("Failed to submit application (/apply/me)")
		raise HTTPException(status_code=500, detail="지원서 제출 중 서버 오류가 발생했습니다.")

# 🌟 3. [공개] 지원자 전용 회원가입
@router.post("/signup")
def signup_applicant(data: recruitment_schemas.ApplicantSignup, db: Session = Depends(get_db)):
	"""지원자용 계정을 생성합니다."""
	try:
		applicant = service.signup_applicant(db, data)
		if not applicant:
			raise HTTPException(status_code=400, detail="이미 가입된 이메일 계정입니다.")
		return {"message": "회원가입이 완료되었습니다.", "applicant_id": applicant.id}
	except HTTPException:
		raise
	except Exception:
		db.rollback()
		logger.exception("Failed to signup applicant")
		raise HTTPException(status_code=500, detail="회원가입 중 서버 오류가 발생했습니다.")

# 🌟 4. [공개] 지원자 전용 로그인
@router.post("/login")
def login_applicant(data: recruitment_schemas.ApplicantLogin, response: Response, db: Session = Depends(get_db)):
	"""지원자 계정으로 로그인합니다."""
	try:
		applicant = service.login_applicant(db, data)
		if not applicant:
			raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")

		token = create_access_token(
			{
				"applicantId": applicant.id,
				"email_id": applicant.email_id,
				"name": applicant.name,
				"phone": applicant.phone,
				"type": "applicant",
			}
		)
		response.set_cookie(value=token, **APPLICANT_COOKIE_OPTIONS)
		
		return {
			"message": "로그인 성공",
			"id": applicant.id,
			"name": applicant.name,
			"email_id": applicant.email_id,
			"phone": applicant.phone
		}
	except HTTPException:
		raise
	except Exception:
		logger.exception("Failed to login applicant")
		raise HTTPException(status_code=500, detail="로그인 중 서버 오류가 발생했습니다.")


@router.post("/logout")
def logout_applicant(response: Response):
	"""지원자 로그아웃: 쿠키 삭제"""
	delete_options = {k: v for k, v in APPLICANT_COOKIE_OPTIONS.items() if k != "max_age"}
	response.delete_cookie(**delete_options)
	return {"success": True, "message": "로그아웃 되었습니다."}


@router.get("/me")
def get_applicant_me(request: Request):
	"""
	지원자 세션 확인. 비로그인·만료 토큰이어도 401이 아닌 200 + isLoggedIn:false
	(채용 공고 열람만 하는 방문자에게 세션 만료 토스트가 뜨지 않도록).
	"""
	payload = get_applicant_jwt_payload_if_any(request)
	if not payload:
		return {"isLoggedIn": False}
	return {
		"isLoggedIn": True,
		"id": payload.get("applicantId"),
		"email_id": payload.get("email_id"),
		"name": payload.get("name"),
		"phone": payload.get("phone"),
	}
# 🌟 5. [공개] 지원자 정보 수정
def _ensure_same_applicant(current_applicant: dict, applicant_id: int) -> int:
	current_id = _applicant_id_from_session(current_applicant)
	if current_id != int(applicant_id):
		raise HTTPException(status_code=403, detail="본인 계정만 접근할 수 있습니다.")
	return current_id


def _update_applicant_impl(db: Session, applicant_id: int, data: recruitment_schemas.ApplicantUpdate):
	applicant = service.update_applicant_info(db, applicant_id, data)
	if not applicant:
		raise HTTPException(status_code=404, detail="계정 정보를 찾을 수 없습니다.")
	return {
		"message": "정보가 성공적으로 수정되었습니다.",
		"id": applicant.id,
		"name": applicant.name,
		"email_id": applicant.email_id,
		"phone": applicant.phone,
	}


@router.put("/update/me")
def update_applicant_me(
	data: recruitment_schemas.ApplicantUpdate,
	db: Session = Depends(get_db),
	current_applicant: dict = Depends(get_current_applicant),
):
	try:
		return _update_applicant_impl(db, _applicant_id_from_session(current_applicant), data)
	except HTTPException:
		raise
	except Exception:
		db.rollback()
		logger.exception("Failed to update applicant (/update/me)")
		raise HTTPException(status_code=500, detail="정보 수정 중 서버 오류가 발생했습니다.")


@router.put("/update/{applicant_id}", deprecated=True)
def update_applicant(
	applicant_id: int,
	data: recruitment_schemas.ApplicantUpdate,
	db: Session = Depends(get_db),
	current_applicant: dict = Depends(get_current_applicant),
):
	try:
		if settings.ENVIRONMENT == "production" or not settings.ALLOW_LEGACY_APPLICANT_ID_ENDPOINTS:
			raise HTTPException(status_code=410, detail="레거시 지원자 엔드포인트는 비활성화되었습니다. /update/me 를 사용해 주세요.")
		logger.warning("Deprecated applicant endpoint called: PUT /update/{applicant_id}")
		_ensure_same_applicant(current_applicant, applicant_id)
		return _update_applicant_impl(db, applicant_id, data)
	except HTTPException:
		raise
	except Exception:
		db.rollback()
		logger.exception("Failed to update applicant (legacy id path)")
		raise HTTPException(status_code=500, detail="정보 수정 중 서버 오류가 발생했습니다.")

# 🌟 6. [공개] 내 지원 내역 조회
@router.get("/my-applications/{applicant_id}", deprecated=True)
def get_my_applications(
	applicant_id: int,
	db: Session = Depends(get_db),
	current_applicant: dict = Depends(get_current_applicant),
):
	"""특정 지원자의 전체 지원 이력을 조회합니다."""
	try:
		if settings.ENVIRONMENT == "production" or not settings.ALLOW_LEGACY_APPLICANT_ID_ENDPOINTS:
			raise HTTPException(status_code=410, detail="레거시 지원자 엔드포인트는 비활성화되었습니다. /my-applications 를 사용해 주세요.")
		logger.warning("Deprecated applicant endpoint called: GET /my-applications/{applicant_id}")
		_ensure_same_applicant(current_applicant, applicant_id)
		return service.get_my_applications(db, _applicant_id_from_session(current_applicant))
	except HTTPException:
		raise
	except Exception:
		logger.exception("Failed to get applicant applications (legacy id path)")
		raise HTTPException(status_code=500, detail="지원 내역 조회 중 서버 오류가 발생했습니다.")

# 6. [공개] 지원 취소
@router.delete("/my-applications/{applicant_id}/{application_id}", deprecated=True)
def cancel_application(
	applicant_id: int,
	application_id: int,
	db: Session = Depends(get_db),
	current_applicant: dict = Depends(get_current_applicant),
):
	"""제출한 지원서를 취소(삭제)합니다."""
	try:
		if settings.ENVIRONMENT == "production" or not settings.ALLOW_LEGACY_APPLICANT_ID_ENDPOINTS:
			raise HTTPException(status_code=410, detail="레거시 지원자 엔드포인트는 비활성화되었습니다. /my-applications/{application_id} 를 사용해 주세요.")
		logger.warning("Deprecated applicant endpoint called: DELETE /my-applications/{applicant_id}/{application_id}")
		_ensure_same_applicant(current_applicant, applicant_id)
		success, msg = service.delete_application(db, _applicant_id_from_session(current_applicant), application_id)
		if not success:
			raise HTTPException(status_code=400, detail=msg)
		return {"message": msg}
	except HTTPException:
		raise
	except Exception:
		db.rollback()
		logger.exception("Failed to cancel application (legacy id path)")
		raise HTTPException(status_code=500, detail="지원 취소 중 서버 오류가 발생했습니다.")


# 신규 권장 API(지원자 ID 노출/의존 제거)
@router.get("/my-applications")
def get_my_applications_me(
	db: Session = Depends(get_db),
	current_applicant: dict = Depends(get_current_applicant),
):
	return service.get_my_applications(db, _applicant_id_from_session(current_applicant))


@router.delete("/my-applications/{application_id}")
def cancel_my_application_me(
	application_id: int,
	db: Session = Depends(get_db),
	current_applicant: dict = Depends(get_current_applicant),
):
	success, msg = service.delete_application(db, _applicant_id_from_session(current_applicant), application_id)
	if not success:
		raise HTTPException(status_code=400, detail=msg)
	return {"message": msg}