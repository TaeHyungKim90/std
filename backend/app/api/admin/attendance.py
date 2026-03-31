from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from db.session import get_db
from services.auth_service import get_current_admin
from services.admin import attendance_service as service
from schemas.admin.attendance_schemas import (
	AdminAttendanceRangeResponse,
	AdminAttendanceRecordOut,
	AdminAttendanceUpdate,
)

router = APIRouter()


@router.patch("/records/{record_id}", response_model=AdminAttendanceRecordOut)
def patch_attendance_record(
	record_id: int,
	body: AdminAttendanceUpdate,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin),
):
	"""[관리자] 단일 근태 기록 수정 (출퇴근 시각·상태)."""
	updates = body.model_dump(exclude_unset=True)
	record = service.update_attendance_record(db, record_id, updates)
	return AdminAttendanceRecordOut.model_validate(record)


@router.get("/user/{user_login_id}/range", response_model=AdminAttendanceRangeResponse)
def get_user_attendance_range(
	user_login_id: str,
	start_date: str = Query(..., description="YYYY-MM-DD"),
	end_date: str = Query(..., description="YYYY-MM-DD"),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin),
):
	"""[관리자] 특정 직원의 기간별 근태 기록 조회."""
	return service.get_user_attendance_range(db, user_login_id, start_date, end_date)


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