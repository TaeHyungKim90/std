from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from db.session import get_db
from services.auth_service import get_current_admin
from services.admin import attendance_service as service

router = APIRouter()

@router.get("/all")
def get_all_attendance(
	user_name: Optional[str] = None,
	work_date: Optional[str] = None,
	skip: int = Query(0, ge=0),
	limit: int = Query(20, ge=1, le=100),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin),
):
	"""[관리자] 전체 직원 근태 기록 조회·필터·페이징."""
	return service.get_all_attendance(db, user_name, work_date, skip=skip, limit=limit)