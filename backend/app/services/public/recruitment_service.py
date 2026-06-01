import os
from typing import Optional, Tuple

from fastapi import HTTPException, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session

from models import recruitment_models
from schemas.public import recruitment_schemas
from services import common_service
from services.tenant_scope import applicants_in_tenant, job_postings_in_tenant
from core.security import get_password_hash, looks_like_password_hash, verify_password
from utils.seoul_time import today_seoul


def get_public_jobs(
	db: Session,
	tenant_id: int,
	skip: int = 0,
	limit: int = 20,
	applicant_id: Optional[int] = None,
):
	"""진행 중(open) 공고 — 테넌트 스코프."""
	today = today_seoul()
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
		job_postings_in_tenant(db, tenant_id)
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


def _require_job_in_tenant(db: Session, tenant_id: int, job_id: int):
	job = (
		job_postings_in_tenant(db, tenant_id)
		.filter(recruitment_models.JobPosting.id == job_id)
		.first()
	)
	if not job:
		raise ValueError("채용 공고를 찾을 수 없습니다.")
	return job


def submit_application(db: Session, tenant_id: int, data: recruitment_schemas.ApplicationCreate):
	_require_job_in_tenant(db, tenant_id, data.job_id)
	applicant = (
		applicants_in_tenant(db, tenant_id)
		.filter(recruitment_models.Applicant.email_id == data.email_id)
		.first()
	)

	if not applicant:
		applicant = recruitment_models.Applicant(
			tenant_id=tenant_id,
			email_id=data.email_id,
			password=get_password_hash(data.password),
			name=data.name,
			phone=data.phone,
		)
		db.add(applicant)
		db.flush()
	else:
		existing_application = (
			db.query(recruitment_models.Application)
			.filter(
				recruitment_models.Application.applicant_id == applicant.id,
				recruitment_models.Application.job_id == data.job_id,
			)
			.first()
		)
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


def submit_application_authenticated(
	db: Session,
	tenant_id: int,
	*,
	applicant_id: int,
	data: recruitment_schemas.ApplicationCreateAuthenticated,
):
	applicant = (
		applicants_in_tenant(db, tenant_id)
		.filter(recruitment_models.Applicant.id == applicant_id)
		.first()
	)
	if not applicant:
		raise ValueError("지원자 계정을 찾을 수 없습니다.")

	job = _require_job_in_tenant(db, tenant_id, data.job_id)
	today = today_seoul()
	if job.deadline is not None and job.deadline < today:
		raise ValueError("지원 마감일이 지난 공고에는 지원할 수 없습니다.")

	existing_application = (
		db.query(recruitment_models.Application)
		.filter(
			recruitment_models.Application.applicant_id == applicant.id,
			recruitment_models.Application.job_id == data.job_id,
		)
		.first()
	)
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


def signup_applicant(db: Session, tenant_id: int, data: recruitment_schemas.ApplicantSignup):
	existing = (
		applicants_in_tenant(db, tenant_id)
		.filter(recruitment_models.Applicant.email_id == data.email_id)
		.first()
	)
	if existing:
		return None

	new_applicant = recruitment_models.Applicant(
		tenant_id=tenant_id,
		email_id=data.email_id,
		password=get_password_hash(data.password),
		name=data.name,
		phone=data.phone,
	)
	db.add(new_applicant)
	db.commit()
	db.refresh(new_applicant)
	return new_applicant


def login_applicant(db: Session, tenant_id: int, data: recruitment_schemas.ApplicantLogin):
	applicant = (
		applicants_in_tenant(db, tenant_id)
		.filter(recruitment_models.Applicant.email_id == data.email_id)
		.first()
	)
	if not applicant:
		return None

	stored = applicant.password
	plain = data.password

	if looks_like_password_hash(stored):
		try:
			return applicant if verify_password(plain, stored) else None
		except Exception:
			return None

	if stored == plain:
		applicant.password = get_password_hash(plain)
		db.commit()
		db.refresh(applicant)
		return applicant
	return None


def update_applicant_info(
	db: Session, tenant_id: int, applicant_id: int, data: recruitment_schemas.ApplicantUpdate
):
	applicant = (
		applicants_in_tenant(db, tenant_id)
		.filter(recruitment_models.Applicant.id == applicant_id)
		.first()
	)
	if not applicant:
		return None

	applicant.name = data.name
	applicant.phone = data.phone
	if data.password and data.password.strip():
		applicant.password = get_password_hash(data.password)

	db.commit()
	db.refresh(applicant)
	return applicant


def get_my_applications(db: Session, tenant_id: int, applicant_id: int):
	applications = (
		db.query(recruitment_models.Application, recruitment_models.JobPosting.title.label("job_title"))
		.join(
			recruitment_models.JobPosting,
			recruitment_models.Application.job_id == recruitment_models.JobPosting.id,
		)
		.filter(
			recruitment_models.Application.applicant_id == applicant_id,
			recruitment_models.JobPosting.tenant_id == tenant_id,
		)
		.order_by(recruitment_models.Application.applied_at.desc())
		.all()
	)

	result = []
	for app, job_title in applications:
		result.append(
			{
				"id": app.id,
				"job_id": app.job_id,
				"job_title": job_title,
				"status": app.status,
				"applied_at": app.applied_at,
			}
		)
	return result


def delete_application(db: Session, tenant_id: int, applicant_id: int, application_id: int):
	application = (
		db.query(recruitment_models.Application)
		.join(
			recruitment_models.JobPosting,
			recruitment_models.Application.job_id == recruitment_models.JobPosting.id,
		)
		.filter(
			recruitment_models.Application.id == application_id,
			recruitment_models.Application.applicant_id == applicant_id,
			recruitment_models.JobPosting.tenant_id == tenant_id,
		)
		.first()
	)

	if not application:
		return False, "지원 내역을 찾을 수 없습니다."

	if application.status != "applied":
		return False, "서류 접수 상태에서만 취소할 수 있습니다."

	db.delete(application)
	db.commit()
	return True, "지원이 취소되었습니다."
