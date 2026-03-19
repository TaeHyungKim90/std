# app/routers/admin/recruitment.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from app.schemas.admin import recruitment_schemas
from app.controllers.admin import recruitment_controller
from app.services import auth_service

router = APIRouter()

# 1. 모든 공고 조회
@router.get("/jobs", response_model=List[recruitment_schemas.JobPostingResponse])
def get_jobs(db: Session = Depends(get_db), current_admin: dict = Depends(auth_service.get_current_admin)):
    return recruitment_controller.get_jobs(db)
# 2. 모든 공고 (CUD)
@router.post("/jobs", response_model=recruitment_schemas.JobPostingResponse)
def create_job(data: recruitment_schemas.JobPostingCreate, db: Session = Depends(get_db), current_admin: dict = Depends(auth_service.get_current_admin)):
    return recruitment_controller.create_job(db, data, current_admin)
@router.put("/jobs/{job_id}")
def update_job(job_id: int, data: recruitment_schemas.JobPostingUpdate, db: Session = Depends(get_db), current_admin = Depends(auth_service.get_current_admin)):
    return recruitment_controller.update_job(db, job_id, data)
@router.delete("/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db), current_admin = Depends(auth_service.get_current_admin)):
    return recruitment_controller.delete_job(db, job_id)

# 3. 특정 공고의 지원서 목록 조회 (GET /api/admin/recruitment/jobs/{job_id}/applications)
@router.get("/jobs/{job_id}/applications", response_model=List[recruitment_schemas.ApplicationResponse])
def get_applications(job_id: int, db: Session = Depends(get_db), current_admin: dict = Depends(auth_service.get_current_admin)):
    return recruitment_controller.get_applications(db, job_id)

# 4. 지원서 상태 업데이트 & 합격자 마이그레이션 (PUT /api/admin/recruitment/applications/{id}/status)
@router.put("/applications/{application_id}/status", response_model=recruitment_schemas.ApplicationResponse)
def update_application_status(application_id: int, 
    data: recruitment_schemas.ApplicationStatusUpdate, 
    db: Session = Depends(get_db), 
    current_admin: dict = Depends(auth_service.get_current_admin)
):
    return recruitment_controller.update_application_status(db, application_id, data)

# 5. 면접 평가 기록 생성 (POST /api/admin/recruitment/applications/{id}/interviews)
@router.post("/applications/{application_id}/interviews", response_model=recruitment_schemas.InterviewResponse)
def create_interview(
    application_id: int, 
    data: recruitment_schemas.InterviewCreate, 
    db: Session = Depends(get_db), 
    current_admin: dict = Depends(auth_service.get_current_admin)
):
    return recruitment_controller.create_interview(db, application_id, data, current_admin)