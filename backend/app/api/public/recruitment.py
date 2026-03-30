from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.public import recruitment_schemas
from services.public import recruitment_service as service

router = APIRouter()

# 1. [공개] 진행 중인 채용 공고 리스트 조회 (페이징)
@router.get("/jobs", response_model=recruitment_schemas.JobPostingPublicListPage)
def get_public_jobs(
	skip: int = Query(0, ge=0),
	limit: int = Query(20, ge=1, le=100),
	db: Session = Depends(get_db),
):
	"""현재 게시 중인 채용 공고를 페이징으로 가져옵니다."""
	try:
		return service.get_public_jobs(db, skip=skip, limit=limit)
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"공고 조회 실패: {str(e)}")

# 2. [공개] 입사 지원서 제출
@router.post("/apply")
def submit_application(data: recruitment_schemas.ApplicationCreate, db: Session = Depends(get_db)):
	"""채용 공고에 지원서를 제출합니다. (중복 지원 체크 포함)"""
	try:
		return service.submit_application(db, data)
	except ValueError as ve:
		# 서비스에서 발생한 '이미 지원함' 등의 비즈니스 예외 처리
		db.rollback()
		raise HTTPException(status_code=400, detail=str(ve))
	except Exception as e:
		db.rollback()
		raise HTTPException(status_code=500, detail=f"지원서 제출 실패: {str(e)}")

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
	except Exception as e:
		db.rollback()
		raise HTTPException(status_code=500, detail=f"회원가입 실패: {str(e)}")

# 🌟 4. [공개] 지원자 전용 로그인
@router.post("/login")
def login_applicant(data: recruitment_schemas.ApplicantLogin, db: Session = Depends(get_db)):
	"""지원자 계정으로 로그인합니다."""
	try:
		applicant = service.login_applicant(db, data)
		if not applicant:
			raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
		
		return {
			"message": "로그인 성공",
			"id": applicant.id,
			"name": applicant.name,
			"email_id": applicant.email_id,
			"phone": applicant.phone
		}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"로그인 실패: {str(e)}")
# 🌟 5. [공개] 지원자 정보 수정
@router.put("/update/{applicant_id}")
def update_applicant(applicant_id: int, data: recruitment_schemas.ApplicantUpdate, db: Session = Depends(get_db)):
	try:
		applicant = service.update_applicant_info(db, applicant_id, data)
		if not applicant:
			raise HTTPException(status_code=404, detail="계정 정보를 찾을 수 없습니다.")
		
		# 수정 후 갱신된 정보를 프론트(세션)로 다시 내려줌
		return {
			"message": "정보가 성공적으로 수정되었습니다.", 
			"id": applicant.id, 
			"name": applicant.name,
			"email_id": applicant.email_id,
			"phone": applicant.phone
		}
	except HTTPException:
		raise
	except Exception as e:
		db.rollback()
		raise HTTPException(status_code=500, detail=f"정보 수정 실패: {str(e)}")

# 🌟 6. [공개] 내 지원 내역 조회
@router.get("/my-applications/{applicant_id}")
def get_my_applications(applicant_id: int, db: Session = Depends(get_db)):
	"""특정 지원자의 전체 지원 이력을 조회합니다."""
	try:
		return service.get_my_applications(db, applicant_id)
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"지원 내역 조회 실패: {str(e)}")

# 6. [공개] 지원 취소
@router.delete("/my-applications/{applicant_id}/{application_id}")
def cancel_application(applicant_id: int, application_id: int, db: Session = Depends(get_db)):
	"""제출한 지원서를 취소(삭제)합니다."""
	try:
		success, msg = service.delete_application(db, applicant_id, application_id)
		if not success:
			raise HTTPException(status_code=400, detail=msg)
		return {"message": msg}
	except HTTPException:
		raise
	except Exception as e:
		db.rollback()
		raise HTTPException(status_code=500, detail=f"지원 취소 실패: {str(e)}")