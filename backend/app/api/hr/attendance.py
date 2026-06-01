from datetime import date as date_type

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.deps import tenant_id_from_user
from db.session import get_db
from services.auth_service import get_current_user_for_tenant
from services.hr import attendance_calendar_service
from services.hr import attendance_service as service
from schemas.hr import attendance_schemas
from schemas.system_schemas import WorkLocationResponse
from utils.seoul_time import now_seoul_naive, today_seoul

router = APIRouter()


def _require_user_id(current_user: dict) -> str:
	uid = current_user.get("userId")
	if not isinstance(uid, str) or not uid.strip():
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증 정보가 올바르지 않습니다.")
	return uid


@router.get("/today", response_model=attendance_schemas.AttendanceResponse | None)
def read_today_attendance(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_for_tenant)):
	"""[유저] 오늘 근무일 행 또는 미종료 야근 행(전일 출근만 한 경우) 조회."""
	tid = tenant_id_from_user(current_user)
	user_id = _require_user_id(current_user)
	return service.get_today_or_open_attendance(db, tid, user_id, today_seoul())


@router.get("/day", response_model=Optional[attendance_schemas.AttendanceResponse])
def read_attendance_for_day(
	work_date: date_type = Query(..., alias="work_date"),
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	"""[유저] 특정 근무일(YYYY-MM-DD)의 본인 출퇴근 기록을 조회합니다. 없으면 null."""
	tid = tenant_id_from_user(current_user)
	user_id = _require_user_id(current_user)
	return service.get_today_attendance(db, tid, user_id, work_date)


@router.get("/day/sessions", response_model=attendance_schemas.AttendanceDaySessionsResponse)
def read_attendance_sessions_for_day(
	work_date: date_type = Query(..., alias="work_date"),
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	"""[유저] 특정 근무일의 세션 전부 + 일별 합산(다회 출근)."""
	from services.hr.attendance_daily_summary_service import summary_dict_for_work_date

	tid = tenant_id_from_user(current_user)
	user_id = _require_user_id(current_user)
	items = service.list_attendance_sessions_for_work_date(db, tid, user_id, work_date)
	summary_raw = summary_dict_for_work_date(db, user_id, work_date)
	summary = (
		attendance_schemas.AttendanceDailySummaryOut.model_validate(summary_raw)
		if summary_raw is not None
		else None
	)
	return attendance_schemas.AttendanceDaySessionsResponse(
		items=[attendance_schemas.AttendanceResponse.model_validate(r) for r in items],
		summary=summary,
	)


@router.get("/calendar-stamps", response_model=attendance_schemas.AttendanceCalendarStampsResponse)
def read_monthly_calendar_stamps(
	year: int = Query(..., ge=2000, le=2100),
	month: int = Query(..., ge=1, le=12),
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	"""[유저] 캘린더에 표시할 본인 월간 출근·퇴근·휴가 도장 상태."""
	user_id = _require_user_id(current_user)
	tid = tenant_id_from_user(current_user)
	return attendance_calendar_service.get_user_monthly_stamps(db, tid, user_id, year, month)


@router.get("/clock-context", response_model=attendance_schemas.AttendanceClockContextResponse)
def read_clock_context(
	work_date: Optional[date_type] = Query(None, description="미지정 시 오늘"),
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	"""[유저] 출근 확인 팝업·휴일 표시용 맥락."""
	tid = tenant_id_from_user(current_user)
	user_id = _require_user_id(current_user)
	d = work_date or today_seoul()
	ctx = service.get_clock_context(db, tid, user_id, d)
	return attendance_schemas.AttendanceClockContextResponse.model_validate(ctx)


@router.patch(
	"/preferred-work-location",
	response_model=attendance_schemas.PreferredWorkLocationResponse,
)
def patch_preferred_work_location(
	body: attendance_schemas.PreferredWorkLocationPatch,
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	"""[유저] 출퇴근 화면 기본 근무장소(활성 목록의 key 또는 표시명으로 저장 시 DB에는 key)."""
	tid = tenant_id_from_user(current_user)
	user_id = _require_user_id(current_user)
	name = service.set_user_preferred_work_location(db, tid, user_id, body.location_name)
	return attendance_schemas.PreferredWorkLocationResponse(preferred_work_location=name)


@router.get("/work-locations", response_model=list[WorkLocationResponse])
def read_active_work_locations(
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	"""[유저] 출퇴근 선택용 활성 근무장소 목록을 조회합니다."""
	_require_user_id(current_user)
	return service.get_active_work_locations(db, tenant_id_from_user(current_user))


@router.post("/clock-in", response_model=attendance_schemas.AttendanceResponse)
def clock_in(req: attendance_schemas.AttendanceRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_for_tenant)):
	"""[유저] 출근 처리 (미종료 근무·당일 중복 출근 방지)"""
	tid = tenant_id_from_user(current_user)
	user_id = _require_user_id(current_user)
	now = now_seoul_naive()
	return service.create_clock_in(
		db,
		tid,
		user_id,
		now,
		record_status="NORMAL",
		location=req.location_name,
		lat=req.latitude,
		lng=req.longitude,
		note=req.note,
		confirm_full_day_vacation=req.confirm_full_day_vacation,
		confirm_official_leave=req.confirm_official_leave,
	)

@router.post("/clock-out", response_model=attendance_schemas.AttendanceResponse)
def clock_out(req: attendance_schemas.AttendanceRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_for_tenant)):
	"""[유저] 퇴근 처리 (출근 기록 확인 및 중복 퇴근 방지)"""
	tid = tenant_id_from_user(current_user)
	user_id = _require_user_id(current_user)
	now = now_seoul_naive()

	record = service.get_open_shift(db, tid, user_id)
	if not record:
		raise HTTPException(status_code=400, detail="출근 기록을 찾을 수 없습니다. 먼저 출근을 해주세요.")
	rec: Any = record
	if rec.clock_out_time is not None:
		raise HTTPException(status_code=400, detail="이미 퇴근 처리가 완료되었습니다.")
	status_str = str(rec.status) if rec.status is not None else "NORMAL"

	return service.update_clock_out(
		db,
		tid,
		record,
		now,
		status_str,
		location=req.location_name,
		lat=req.latitude,
		lng=req.longitude,
		note=req.note,
	)