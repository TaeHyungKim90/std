from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from api.deps import tenant_id_from_user
from db.session import get_db
from services.auth_service import get_current_admin_for_tenant
from services.admin import attendance_reward_service
from services.admin import attendance_service as service
from schemas.admin.attendance_schemas import (
	AdminAttendanceCreate,
	AdminAttendanceMonthlyRewardsResponse,
	AdminAttendanceRangeResponse,
	AdminAttendanceRecordOut,
	AdminAttendanceRecomputeResponse,
	AdminAttendanceUpdate,
)

router = APIRouter()


@router.post("/records", response_model=AdminAttendanceRecordOut)
def post_attendance_record(
	body: AdminAttendanceCreate,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	"""[관리자] 근태 1건 생성(해당 user·work_date에 행이 없을 때만). 가상 결근 행을 실제 기록으로 바꾼 때 사용."""
	payload = body.model_dump(exclude_unset=True)
	user_login_id = str(payload.pop("user_login_id", "")).strip()
	work_date = payload.pop("work_date")
	record = service.create_attendance_record(db, user_login_id, work_date, payload)
	return AdminAttendanceRecordOut.model_validate(record)


@router.patch("/records/{record_id}", response_model=AdminAttendanceRecordOut)
def patch_attendance_record(
	record_id: int,
	body: AdminAttendanceUpdate,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	"""[관리자] 근태 기록 수정 (관리자 권한)."""
	updates = body.model_dump(exclude_unset=True)
	record = service.update_attendance_record(db, record_id, updates)
	return AdminAttendanceRecordOut.model_validate(record)


@router.get("/user/{user_login_id}/range", response_model=AdminAttendanceRangeResponse)
def get_user_attendance_range(
	user_login_id: str,
	start_date: str = Query(..., description="YYYY-MM-DD"),
	end_date: str = Query(..., description="YYYY-MM-DD"),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	"""[관리자] 특정 직원 근태 기간 조회."""
	tid = tenant_id_from_user(current_admin)
	return service.get_user_attendance_range(db, tid, user_login_id, start_date, end_date)


@router.get("/all")
def get_all_attendance(
	user_name: Optional[str] = None,
	work_date: Optional[str] = None,
	skip: int = Query(0, ge=0),
	limit: int = Query(20, ge=1, le=100),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	"""[관리자] 전체 직원 일일 근태 조회."""
	tid = tenant_id_from_user(current_admin)
	return service.get_all_attendance(db, tid, user_name, work_date, skip=skip, limit=limit)


@router.get("/monthly-rewards", response_model=AdminAttendanceMonthlyRewardsResponse)
def get_monthly_attendance_rewards(
	year: int = Query(..., ge=2000, le=2100),
	month: int = Query(..., ge=1, le=12),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	"""[관리자] 월별 근태 리워드 집계 조회."""
	tid = tenant_id_from_user(current_admin)
	return attendance_reward_service.get_monthly_attendance_rewards(db, tid, year, month)


@router.post("/recompute-work-minutes", response_model=AdminAttendanceRecomputeResponse)
def post_recompute_work_minutes(
	start_date: str = Query(..., description="YYYY-MM-DD"),
	end_date: str = Query(..., description="YYYY-MM-DD"),
	dry_run: bool = Query(
		True,
		description="true면 변경 미리보기만. false면 DB에 work_minutes 반영",
	),
	user_login_id: Optional[str] = Query(
		None,
		description="지정 시 해당 직원만 재계산 (선택)",
	),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	"""[관리자] 기간 내 근태 work_minutes 일괄 재계산 (관리자 전용).

	기본 dry_run=true 로 `changes`만 반환하고, dry_run=false 일 때 DB 반영.
	"""
	raw = service.recompute_work_minutes_bulk(
		db,
		start_date,
		end_date,
		user_login_id=user_login_id,
		dry_run=dry_run,
	)
	return AdminAttendanceRecomputeResponse.model_validate(raw)
