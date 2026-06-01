from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session
from typing import List

from api.deps import tenant_id_from_user
from db.session import get_db
from schemas.admin import recruitment_schemas, resume_template_schemas
from services.admin import recruitment_service, resume_template_service as resume_template_svc
from services.auth_service import get_current_admin_for_tenant

router = APIRouter()


@router.get("/jobs", response_model=recruitment_schemas.JobPostingListPage)
def get_jobs(
	skip: int = Query(0, ge=0),
	limit: int = Query(20, ge=1, le=100),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return recruitment_service.get_all_job_postings(db, tid, skip=skip, limit=limit)


@router.post("/jobs", response_model=recruitment_schemas.JobPostingResponse)
def create_job(
	data: recruitment_schemas.JobPostingCreate,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return recruitment_service.create_job_posting(db, tid, data, current_admin["userId"])


@router.put("/jobs/{job_id}")
def update_job(
	job_id: int,
	data: recruitment_schemas.JobPostingUpdate,
	db: Session = Depends(get_db),
	current_admin=Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return recruitment_service.update_job_posting(db, tid, job_id, data)


@router.delete("/jobs/{job_id}")
def delete_job(
	job_id: int,
	db: Session = Depends(get_db),
	current_admin=Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return recruitment_service.delete_job_posting(db, tid, job_id)


@router.get("/jobs/{job_id}/applications", response_model=List[recruitment_schemas.ApplicationResponse])
def get_applications(
	job_id: int,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return recruitment_service.get_applications_by_job(db, tid, job_id)


@router.put("/applications/{application_id}/status", response_model=recruitment_schemas.ApplicationResponse)
def update_application_status(
	application_id: int,
	data: recruitment_schemas.ApplicationStatusUpdate,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return recruitment_service.update_application_status(db, tid, application_id, data.status)


@router.post("/applications/{application_id}/interviews", response_model=recruitment_schemas.InterviewResponse)
def create_interview(
	application_id: int,
	data: recruitment_schemas.InterviewCreate,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return recruitment_service.create_interview(
		db, tid, application_id, data, current_admin["userId"]
	)


@router.get("/applicants/password-audit")
def applicant_password_audit(
	sample_size: int = Query(10, ge=0, le=50),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return recruitment_service.audit_applicant_password_storage(db, tid, sample_size=sample_size)


@router.post("/applicants/password-migrate")
def migrate_applicant_passwords(
	dry_run: bool = Query(False),
	max_rows: int | None = Query(None, ge=1, le=200000),
	batch_size: int = Query(1000, ge=1, le=10000),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return recruitment_service.migrate_applicant_passwords_to_hash(
		db,
		tid,
		dry_run=dry_run,
		max_rows=max_rows,
		batch_size=batch_size,
	)


@router.get("/resume-templates", response_model=resume_template_schemas.ResumeTemplateListPage)
def list_resume_templates(
	include_deleted: bool = Query(False),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	items = resume_template_svc.list_templates(db, tid, include_deleted=include_deleted)
	return {"items": items, "total": len(items)}


@router.post("/resume-templates", response_model=resume_template_schemas.ResumeTemplateResponse)
async def create_resume_template(
	name: str = Form(...),
	is_default: bool = Form(False),
	file: UploadFile = File(...),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return resume_template_svc.create_template(
		db, tid, name=name, file=file, set_default=is_default
	)


@router.patch("/resume-templates/{template_id}", response_model=resume_template_schemas.ResumeTemplateResponse)
def patch_resume_template(
	template_id: int,
	body: resume_template_schemas.ResumeTemplatePatch,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return resume_template_svc.update_template(
		db, tid, template_id, name=body.name, is_default=body.is_default, file=None
	)


@router.put("/resume-templates/{template_id}/file", response_model=resume_template_schemas.ResumeTemplateResponse)
async def replace_resume_template_file(
	template_id: int,
	file: UploadFile = File(...),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return resume_template_svc.update_template(db, tid, template_id, file=file)


@router.delete("/resume-templates/{template_id}")
def delete_resume_template(
	template_id: int,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	resume_template_svc.soft_delete_template(db, tid, template_id)
	return {"message": "양식(템클릿)이 삭제되었습니다."}
