from typing import Any

from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import datetime
from models import recruitment_models, auth_models
from schemas.admin import recruitment_schemas
from services import auth_service
from services.admin import resume_template_service as resume_template_svc
from core.security import get_password_hash, looks_like_password_hash

# --- 1. 채용 공고 관리 ---
def create_job_posting(db: Session, data: recruitment_schemas.JobPostingCreate, author_id: str):
	tid = resume_template_svc.resolve_template_id_for_new_job(db, data.resume_template_id)
	new_job = recruitment_models.JobPosting(
		title=data.title,
		description=data.description,
		deadline=data.deadline,
		status=data.status,
		author_id=author_id,
		resume_template_id=tid,
	)
	db.add(new_job)
	db.commit()
	db.refresh(new_job)
	return new_job

def get_all_job_postings(db: Session, skip: int = 0, limit: int = 20):
	q = db.query(recruitment_models.JobPosting).order_by(recruitment_models.JobPosting.created_at.desc())
	total = q.count()
	items = q.offset(skip).limit(limit).all()
	return {"items": items, "total": total}

def update_job_posting(db: Session, job_id: int, data: recruitment_schemas.JobPostingUpdate):
	job = db.query(recruitment_models.JobPosting).filter(recruitment_models.JobPosting.id == job_id).first()
	if not job:
		raise HTTPException(status_code=404, detail="공고를 찾을 수 없습니다.")
	patch = data.model_dump(exclude_unset=True)
	if "resume_template_id" in patch:
		if patch["resume_template_id"] is None:
			raise HTTPException(status_code=400, detail="이력서 템플릿을 비울 수 없습니다. 템플릿을 선택해 주세요.")
		resume_template_svc.assert_template_active_for_job(db, int(patch["resume_template_id"]))
	for key, value in patch.items():
		setattr(job, key, value)
	db.commit()
	db.refresh(job)
	return job

def delete_job_posting(db: Session, job_id: int):
	job = db.query(recruitment_models.JobPosting).filter(recruitment_models.JobPosting.id == job_id).first()
	if not job:
		raise HTTPException(status_code=404, detail="공고를 찾을 수 없습니다.")
	db.delete(job)
	db.commit()
	return {"message": "삭제 완료"}

# --- 2. 지원자 현황 및 상태 변경 (칸반 로직) ---
def get_applications_by_job(db: Session, job_id: int):
	return db.query(recruitment_models.Application)\
			 .filter(recruitment_models.Application.job_id == job_id)\
			 .all()

def update_application_status(db: Session, application_id: int, status_str: str):
	application = db.query(recruitment_models.Application).filter(recruitment_models.Application.id == application_id).first()
	if not application:
		raise HTTPException(status_code=404, detail="지원 내역을 찾을 수 없습니다.")

	app_row: Any = application
	app_row.status = status_str

	# 🔥 최종 합격(final_passed) 시 임직원으로 자동 등록
	if status_str == "final_passed":
		applicant = app_row.applicant
		# 이미 등록된 유저인지 체크
		existing_user = db.query(auth_models.User).filter(auth_models.User.user_login_id == applicant.email_id).first()
		if not existing_user:
			# 지원자 레거시 데이터(평문 비밀번호) 대비: 직원 계정에는 항상 해시 저장
			applicant_pw = (applicant.password or "").strip()
			if not applicant_pw:
				raise HTTPException(status_code=400, detail="지원자 비밀번호가 비어 있어 직원 계정을 생성할 수 없습니다.")
			if not looks_like_password_hash(applicant_pw):
				applicant_pw = get_password_hash(applicant_pw)
			new_employee = auth_models.User(
				user_login_id=applicant.email_id,
				user_password=applicant_pw, # 지원 시 사용한 비밀번호(해시) 계승
				user_name=applicant.name,
				user_nickname=f"{applicant.name} 사원",
				role="user",
				join_date=datetime.now().date()
			)
			db.add(new_employee)

	db.commit()
	db.refresh(app_row)
	return app_row


def audit_applicant_password_storage(db: Session, sample_size: int = 10) -> dict:
	"""
	지원자(applicants) 비밀번호 저장 형태 점검.
	- 해시로 보이지 않는 값은 레거시 평문일 가능성이 높음.
	- 샘플에는 비밀번호 본문을 포함하지 않음.
	"""
	total = db.query(recruitment_models.Applicant.id).count()
	plaintext_like_count = 0
	sample = []
	need_sample = max(0, int(sample_size))

	# 대용량 고려: 필요한 컬럼만 스트리밍(yield_per)으로 순회
	q = (
		db.query(
			recruitment_models.Applicant.id,
			recruitment_models.Applicant.email_id,
			recruitment_models.Applicant.created_at,
			recruitment_models.Applicant.password,
		)
		.order_by(recruitment_models.Applicant.id.asc())
		.yield_per(1000)
	)
	for row in q:
		pw = (row.password or "").strip()
		if pw and looks_like_password_hash(pw):
			continue
		plaintext_like_count += 1
		if need_sample and len(sample) < need_sample:
			sample.append(
				{
					"id": row.id,
					"email_id": row.email_id,
					"created_at": row.created_at,
				}
			)

	return {
		"total_applicants": total,
		"hashed_like_count": total - plaintext_like_count,
		"plaintext_like_count": plaintext_like_count,
		"plaintext_like_sample": sample,
	}


def migrate_applicant_passwords_to_hash(
	db: Session,
	*,
	dry_run: bool = False,
	max_rows: int | None = None,
	batch_size: int = 1000,
) -> dict:
	"""
	레거시 지원자 비밀번호(평문 추정)를 passlib 해시로 일괄 변환합니다.
	- 이미 해시로 보이는 값은 건드리지 않음(재해싱 방지).
	- 비어 있는 비밀번호는 스킵.
	"""
	if batch_size < 1:
		batch_size = 1000

	total = db.query(recruitment_models.Applicant.id).count()
	migrated = 0
	skipped_hashed = 0
	skipped_empty = 0
	processed = 0
	pending_commit = 0

	q = (
		db.query(recruitment_models.Applicant)
		.order_by(recruitment_models.Applicant.id.asc())
		.yield_per(batch_size)
	)
	for a_raw in q:
		a: Any = a_raw
		if max_rows is not None and processed >= max_rows:
			break
		processed += 1

		pw = (a.password or "").strip()
		if not pw:
			skipped_empty += 1
			continue
		if looks_like_password_hash(pw):
			skipped_hashed += 1
			continue

		migrated += 1
		if not dry_run:
			a.password = get_password_hash(pw)
			pending_commit += 1
			if pending_commit >= batch_size:
				db.commit()
				pending_commit = 0

	if not dry_run and pending_commit > 0:
		db.commit()

	return {
		"total_applicants": total,
		"processed_count": processed,
		"migrated_count": migrated,
		"skipped_hashed_count": skipped_hashed,
		"skipped_empty_count": skipped_empty,
		"dry_run": dry_run,
	}

# --- 3. 면접 평가 기록 ---
def create_interview(db: Session, application_id: int, data: recruitment_schemas.InterviewCreate, interviewer_id: str):
	new_interview = recruitment_models.Interview(
		application_id=application_id,
		interviewer_id=interviewer_id,
		interview_date=data.interview_date,
		score=data.score,
		feedback=data.feedback
	)
	db.add(new_interview)
	db.commit()
	db.refresh(new_interview)
	return new_interview