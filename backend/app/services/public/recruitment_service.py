import os
from datetime import date, datetime
from typing import Optional, Tuple
from zoneinfo import ZoneInfo

from fastapi import UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session

from models import recruitment_models
from schemas.public import recruitment_schemas
from services import common_service
from core.security import get_password_hash, looks_like_password_hash, verify_password

_SEOUL = ZoneInfo("Asia/Seoul")


def seoul_today() -> date:
	return datetime.now(_SEOUL).date()


def get_public_jobs(db: Session, skip: int = 0, limit: int = 20, applicant_id: Optional[int] = None):
	"""진행 중(open) 공고 중, 마감 전이거나(게스트 포함) 로그인 지원자가 이미 지원한 공고는 마감 후에도 노출."""
	today = seoul_today()
	applied_ids: set[int] = set()
	if applicant_id is not None:
		applied_ids = {
			int(r[0])
			for r in db.query(recruitment_models.Application.job_id)
			.filter(recruitment_models.Application.applicant_id == applicant_id)
			.distinct()
			.all()
		}

	visibility = or_(
		recruitment_models.JobPosting.deadline.is_(None),
		recruitment_models.JobPosting.deadline >= today,
	)
	if applied_ids:
		visibility = or_(visibility, recruitment_models.JobPosting.id.in_(applied_ids))

	q = (
		db.query(recruitment_models.JobPosting)
		.filter(recruitment_models.JobPosting.status == "open")
		.filter(visibility)
		.order_by(recruitment_models.JobPosting.created_at.desc())
	)
	total = q.count()
	items = q.offset(skip).limit(limit).all()
	out = []
	for j in items:
		out.append(
			{
				"id": j.id,
				"title": j.title,
				"description": j.description,
				"deadline": j.deadline,
				"resume_template_id": j.resume_template_id,
				"has_applied": j.id in applied_ids,
			}
		)
	return {"items": out, "total": total}


_PORTFOLIO_EXT = {".pdf", ".zip"}


async def upload_application_attachments(
	db: Session,
	resume: UploadFile,
	portfolio: Optional[UploadFile] = None,
) -> Tuple[str, Optional[str]]:
	ext = os.path.splitext(resume.filename or "")[1].lower()
	if ext != ".docx":
		raise ValueError("이력서는 .docx(워드) 파일만 업로드할 수 있습니다.")
	ct = (resume.content_type or "").lower()
	if ct and "wordprocessingml" not in ct and ct not in ("application/octet-stream", "application/zip"):
		raise ValueError("이력서 파일 형식이 올바르지 않습니다.")

	to_save = [resume]
	if portfolio is not None and (portfolio.filename or "").strip():
		pe = os.path.splitext(portfolio.filename or "")[1].lower()
		if pe not in _PORTFOLIO_EXT:
			raise ValueError("포트폴리오는 PDF 또는 ZIP만 업로드할 수 있습니다.")
		to_save.append(portfolio)

	saved = await common_service.save_files_to_db_and_disk(db, to_save)
	resume_url = saved[0].file_path
	portfolio_url = saved[1].file_path if len(saved) > 1 else None
	return resume_url, portfolio_url

def submit_application(db: Session, data: recruitment_schemas.ApplicationCreate):
	"""지원자 계정을 확인/생성하고 지원 내역을 접수합니다."""
	applicant = db.query(recruitment_models.Applicant).filter(
		recruitment_models.Applicant.email_id == data.email_id
	).first()

	if not applicant:
		applicant = recruitment_models.Applicant(
			email_id=data.email_id,
			password=get_password_hash(data.password),
			name=data.name,
			phone=data.phone
		)
		db.add(applicant)
		db.flush()
	else:
		# 🌟 중복 지원 체크 로직 추가 (회원이 존재할 때만 검사)
		existing_application = db.query(recruitment_models.Application).filter(
			recruitment_models.Application.applicant_id == applicant.id,
			recruitment_models.Application.job_id == data.job_id
		).first()
		
		if existing_application:
			# 중복일 경우 ValueError 발생 (컨트롤러에서 잡아서 처리)
			raise ValueError("이미 지원이 완료된 공고입니다.")
	
	new_application = recruitment_models.Application(
		job_id=data.job_id,
		applicant_id=applicant.id,
		resume_file_url=data.resume_file_url,
		portfolio_file_url=data.portfolio_file_url,
		status="applied"
	)
	db.add(new_application)
	db.commit()
	db.refresh(new_application)
	
	return {"message": "입사 지원이 완료되었습니다.", "application_id": new_application.id}


def submit_application_authenticated(
	db: Session,
	*,
	applicant_id: int,
	data: recruitment_schemas.ApplicationCreateAuthenticated,
):
	"""로그인된 지원자(쿠키 세션) 기준으로 지원 내역을 접수합니다."""
	applicant = db.query(recruitment_models.Applicant).filter(recruitment_models.Applicant.id == applicant_id).first()
	if not applicant:
		raise ValueError("지원자 계정을 찾을 수 없습니다.")

	job = db.query(recruitment_models.JobPosting).filter(recruitment_models.JobPosting.id == data.job_id).first()
	if not job:
		raise ValueError("채용 공고를 찾을 수 없습니다.")
	today = seoul_today()
	if job.deadline is not None and job.deadline < today:
		raise ValueError("지원 마감일이 지난 공고에는 지원할 수 없습니다.")

	existing_application = db.query(recruitment_models.Application).filter(
		recruitment_models.Application.applicant_id == applicant.id,
		recruitment_models.Application.job_id == data.job_id
	).first()
	if existing_application:
		raise ValueError("이미 지원이 완료된 공고입니다.")

	new_application = recruitment_models.Application(
		job_id=data.job_id,
		applicant_id=applicant.id,
		resume_file_url=data.resume_file_url,
		portfolio_file_url=data.portfolio_file_url,
		status="applied",
	)
	db.add(new_application)
	db.commit()
	db.refresh(new_application)
	return {"message": "입사 지원이 완료되었습니다.", "application_id": new_application.id}

# 🌟 1. 회원가입 비즈니스 로직
def signup_applicant(db: Session, data: recruitment_schemas.ApplicantSignup):
	# 중복 이메일 체크
	existing = db.query(recruitment_models.Applicant).filter(
		recruitment_models.Applicant.email_id == data.email_id
	).first()
	
	if existing:
		return None # 컨트롤러에서 400 에러 처리

	new_applicant = recruitment_models.Applicant(
		email_id=data.email_id,
		password=get_password_hash(data.password),
		name=data.name,
		phone=data.phone
	)
	db.add(new_applicant)
	db.commit()
	db.refresh(new_applicant)
	return new_applicant

# 🌟 2. 로그인 비즈니스 로직
def login_applicant(db: Session, data: recruitment_schemas.ApplicantLogin):
	applicant = (
		db.query(recruitment_models.Applicant)
		.filter(recruitment_models.Applicant.email_id == data.email_id)
		.first()
	)
	if not applicant:
		return None

	stored = applicant.password
	plain = data.password

	# 1) 정상 케이스: 해시 저장 + 검증
	if looks_like_password_hash(stored):
		try:
			return applicant if verify_password(plain, stored) else None
		except Exception:
			# 해시가 깨졌거나 스킴 불일치 등
			return None

	# 2) 레거시 케이스: 평문 저장 → 일치하면 즉시 해시로 업그레이드
	if stored == plain:
		applicant.password = get_password_hash(plain)
		db.commit()
		db.refresh(applicant)
		return applicant
	return None

# 🌟 3. 지원자 정보 수정 비즈니스 로직
def update_applicant_info(db: Session, applicant_id: int, data: recruitment_schemas.ApplicantUpdate):
	applicant = db.query(recruitment_models.Applicant).filter(
		recruitment_models.Applicant.id == applicant_id
	).first()
	
	if not applicant:
		return None
	
	# 전달받은 정보로 업데이트
	applicant.name = data.name
	applicant.phone = data.phone
	
	# 비밀번호는 입력값이 있을 때만 변경
	if data.password and data.password.strip():
		applicant.password = get_password_hash(data.password)
		
	db.commit()
	db.refresh(applicant)
	return applicant

# 🌟 4. 내 지원 내역 조회 비즈니스 로직
def get_my_applications(db: Session, applicant_id: int):
	# Application 테이블과 JobPosting 테이블을 조인하여 공고 제목까지 한 번에 가져옵니다.
	applications = db.query(
		recruitment_models.Application, 
		recruitment_models.JobPosting.title.label("job_title")
	).join(
		recruitment_models.JobPosting, 
		recruitment_models.Application.job_id == recruitment_models.JobPosting.id
	).filter(
		recruitment_models.Application.applicant_id == applicant_id
	).order_by(recruitment_models.Application.applied_at.desc()).all()
	
	result = []
	for app, job_title in applications:
		result.append({
			"id": app.id,
			"job_id": app.job_id,
			"job_title": job_title,
			"status": app.status,
			"applied_at": app.applied_at
		})
	return result
# 🌟 5. 지원 내역 취소 (삭제) 비즈니스 로직
def delete_application(db: Session, applicant_id: int, application_id: int):
	# 본인의 지원서가 맞는지 확인
	application = db.query(recruitment_models.Application).filter(
		recruitment_models.Application.id == application_id,
		recruitment_models.Application.applicant_id == applicant_id
	).first()

	if not application:
		return False, "지원 내역을 찾을 수 없습니다."
	
	# 🚨 핵심: 서류 접수(applied) 상태일 때만 삭제 허용
	if application.status != "applied":
		return False, "서류 접수 상태에서만 취소할 수 있습니다."

	db.delete(application)
	db.commit()
	return True, "지원이 취소되었습니다."