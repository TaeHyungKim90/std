from datetime import date as date_type
from datetime import datetime

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from db.session import get_db
from services.auth_service import get_current_user
from services.hr import attendance_service as service
from schemas.hr import attendance_schemas

router = APIRouter()


def _require_user_id(current_user: dict) -> str:
	uid = current_user.get("userId")
	if not isinstance(uid, str) or not uid.strip():
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증 정보가 올바르지 않습니다.")
	return uid


@router.get("/today", response_model=attendance_schemas.AttendanceResponse | None)
def read_today_attendance(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
	"""[유저] 오늘의 출퇴근 기록을 조회합니다."""
	user_id = _require_user_id(current_user)
	now = datetime.now()
	return service.get_today_attendance(db, user_id, now.date())


@router.get("/day", response_model=Optional[attendance_schemas.AttendanceResponse])
def read_attendance_for_day(
	work_date: date_type = Query(..., alias="work_date"),
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user),
):
	"""[유저] 특정 근무일(YYYY-MM-DD)의 본인 출퇴근 기록을 조회합니다. 없으면 null."""
	user_id = _require_user_id(current_user)
	return service.get_today_attendance(db, user_id, work_date)

@router.post("/clock-in", response_model=attendance_schemas.AttendanceResponse)
def clock_in(req: attendance_schemas.AttendanceRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
	"""[유저] 출근 처리 (중복 출근 방지 로직 포함)"""
	user_id = _require_user_id(current_user)
	now = datetime.now()

	# 최상단 방어 로직: 입사일 미등록자/휴가자 출근 차단
	service.assert_user_can_clock_in(db, user_id, now)

	record = service.get_today_attendance(db, user_id, now.date())
	if record:
		# 이미 존재하는 Attendance가 휴가 상태인 경우는 방어 로직에서 잡아야 하지만,
		# 혹시 모를 예외를 위해 여기서도 메시지를 분기합니다.
		if service.is_vacation_status(record.status):
			raise HTTPException(status_code=400, detail="휴가 중에는 출근을 기록할 수 없습니다.")
		raise HTTPException(status_code=400, detail="이미 출근 기록이 존재합니다.")

	return service.create_clock_in(db, user_id, now, status="NORMAL", location=req.location_name, lat=req.latitude, lng=req.longitude, note=req.note)

@router.post("/clock-out", response_model=attendance_schemas.AttendanceResponse)
def clock_out(req: attendance_schemas.AttendanceRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
	"""[유저] 퇴근 처리 (출근 기록 확인 및 중복 퇴근 방지)"""
	user_id = _require_user_id(current_user)
	now = datetime.now()
	
	record = service.get_today_attendance(db, user_id, now.date())
	if not record:
		raise HTTPException(status_code=400, detail="출근 기록을 찾을 수 없습니다. 먼저 출근을 해주세요.")
	rec: Any = record
	if rec.clock_out_time is not None:
		raise HTTPException(status_code=400, detail="이미 퇴근 처리가 완료되었습니다.")
	status_str = str(rec.status) if rec.status is not None else "NORMAL"

	return service.update_clock_out(
		db,
		record,
		now,
		status_str,
		location=req.location_name,
		lat=req.latitude,
		lng=req.longitude,
		note=req.note,
	)