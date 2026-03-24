from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from db.session import get_db
from services.auth_service import get_current_admin
from services.admin import attendance_service as service

router = APIRouter()

@router.get("/all")
def get_all_attendance(user_name: Optional[str] = None, work_date: Optional[str] = None, db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
    """[관리자] 전체 직원의 근태 기록을 조회 및 필터링합니다."""
    return service.get_all_attendance(db, user_name, work_date)