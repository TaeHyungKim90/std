from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from db.session import get_db
from schemas.admin import recruitment_schemas
from services.admin import recruitment_service
from services.auth_service import get_current_admin

router = APIRouter()

# 1. 모든 공고 조회 (페이징)
@router.get("/jobs", response_model=recruitment_schemas.JobPostingListPage)
def get_jobs(
	skip: int = Query(0, ge=0),
	limit: int = Query(20, ge=1, le=100),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin),
):
	return recruitment_service.get_all_job_postings(db, skip=skip, limit=limit)

# 2. 모든 공고 (CUD)
@router.post("/jobs", response_model=recruitment_schemas.JobPostingResponse)
def create_job(data: recruitment_schemas.JobPostingCreate, db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
	return recruitment_service.create_job_posting(db, data, current_admin["userId"])

@router.put("/jobs/{job_id}")
def update_job(job_id: int, data: recruitment_schemas.JobPostingUpdate, db: Session = Depends(get_db), current_admin = Depends(get_current_admin)):
	return recruitment_service.update_job_posting(db, job_id, data)

@router.delete("/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db), current_admin = Depends(get_current_admin)):
	return recruitment_service.delete_job_posting(db, job_id)

# 3. 특정 공고의 지원서 목록 조회 (GET /api/admin/recruitment/jobs/{job_id}/applications)
@router.get("/jobs/{job_id}/applications", response_model=List[recruitment_schemas.ApplicationResponse])
def get_applications(job_id: int, db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
	return recruitment_service.get_applications_by_job(db, job_id)

# 4. 지원서 상태 업데이트 & 합격자 마이그레이션 (PUT /api/admin/recruitment/applications/{id}/status)
@router.put("/applications/{application_id}/status", response_model=recruitment_schemas.ApplicationResponse)
def update_application_status(application_id: int, data: recruitment_schemas.ApplicationStatusUpdate, db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
	return recruitment_service.update_application_status(db, application_id, data.status)

# 5. 면접 평가 기록 생성 (POST /api/admin/recruitment/applications/{id}/interviews)
@router.post("/applications/{application_id}/interviews", response_model=recruitment_schemas.InterviewResponse)
def create_interview(application_id: int, data: recruitment_schemas.InterviewCreate, db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
	return recruitment_service.create_interview(db, application_id, data, current_admin["userId"])


# 6. [관리자] 지원자 비밀번호 저장 형태 감사(audit)
@router.get("/applicants/password-audit")
def applicant_password_audit(
	sample_size: int = Query(10, ge=0, le=50),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin),
):
	return recruitment_service.audit_applicant_password_storage(db, sample_size=sample_size)


# 7. [관리자] 지원자 비밀번호 일괄 해시 마이그레이션
@router.post("/applicants/password-migrate")
def migrate_applicant_passwords(
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin),
):
	return recruitment_service.migrate_applicant_passwords_to_hash(db)