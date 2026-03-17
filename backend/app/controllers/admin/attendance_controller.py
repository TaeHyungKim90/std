from sqlalchemy.orm import Session
from typing import Optional
from app.services.admin import attendance_service

def get_all_attendance(db: Session, user_name: Optional[str] = None, work_date: Optional[str] = None):
    # 필터링 조건이 포함된 서비스 함수 호출
    return attendance_service.get_all_attendance(db, user_name, work_date)