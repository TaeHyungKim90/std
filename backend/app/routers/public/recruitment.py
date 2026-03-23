from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from app.schemas.public import recruitment_schemas      # 새로 만든 퍼블릭 스키마
from app.controllers.public import recruitment_controller # 새로 만든 퍼블릭 컨트롤러

router = APIRouter()

# 1. [공개] 진행 중인 채용 공고 리스트 조회
@router.get("/jobs", response_model=List[recruitment_schemas.JobPostingPublicResponse])
def get_public_jobs(db: Session = Depends(get_db)):
    return recruitment_controller.get_public_jobs(db)

# 2. [공개] 입사 지원서 제출
@router.post("/apply")
def submit_application(data: recruitment_schemas.ApplicationCreate, db: Session = Depends(get_db)):
    return recruitment_controller.apply_job(db, data)