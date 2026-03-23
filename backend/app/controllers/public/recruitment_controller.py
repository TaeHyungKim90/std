from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.services.public import recruitment_service
from app.schemas.public import recruitment_schemas

def get_public_jobs(db: Session):
    try:
        return recruitment_service.get_public_jobs(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"공고 조회 실패: {str(e)}")

def apply_job(db: Session, data: recruitment_schemas.ApplicationCreate):
    try:
        return recruitment_service.submit_application(db, data)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"지원서 제출 실패: {str(e)}")