# app/controllers/admin/recruitment_controller.py
from sqlalchemy.orm import Session
from app.schemas.admin import recruitment_schemas
from app.services.admin import recruitment_service

def create_job(db: Session, data: recruitment_schemas.JobPostingCreate, current_admin: dict):
    # 토큰에서 추출한 관리자 ID(userId)를 작성자로 넘겨줍니다.
    return recruitment_service.create_job_posting(db, data, current_admin["userId"])

def get_jobs(db: Session):
    return recruitment_service.get_all_job_postings(db)

def get_applications(db: Session, job_id: int):
    return recruitment_service.get_applications_by_job(db, job_id)

def update_application_status(db: Session, application_id: int, data: recruitment_schemas.ApplicationStatusUpdate):
    return recruitment_service.update_application_status(db, application_id, data.status)

def create_interview(db: Session, application_id: int, data: recruitment_schemas.InterviewCreate, current_admin: dict):
    # 토큰에서 추출한 관리자 ID를 면접관으로 지정합니다.
    return recruitment_service.create_interview(db, application_id, data, current_admin["userId"])