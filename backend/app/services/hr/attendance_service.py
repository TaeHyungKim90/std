from datetime import date, datetime, time
from typing import Any, cast

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from constants.vacation_categories import (
	VACATION_TODO_CATEGORIES,
	VACATION_TODO_REQUIRES_FULL_DAY_CONFIRM,
	VACATION_TODO_REQUIRES_OFFICIAL_LEAVE_CONFIRM,
	VACATION_STATUS_KEYWORDS,
)
from core.config import settings
from models.hr_models import Attendance, Todo
from models.auth_models import User
from models.holiday_models import Holiday


def is_vacation_status(status_str: Any) -> bool:
	"""Attendance.status 문자열 기반 휴가 키워드 판별.

	SQLAlchemy 인스턴스의 status는 정적 분석상 Column[str]로 잡힐 수 있어 Any로 받음.
	"""
	if status_str is None:
		return False
	s = str(status_str)
	s_upper = s.upper()
	for keyword in VACATION_STATUS_KEYWORDS:
		if keyword.isascii():
			if keyword in s_upper:
				return True
		elif keyword in s:
			return True
	return False


def _vacation_todos_for_day(db: Session, user_id: str, target_date: date) -> list[Todo]:
	day_start = datetime.combine(target_date, time.min)
	day_end = datetime.combine(target_date, time.max)
	return (
		db.query(Todo)
		.filter(Todo.user_id == user_id)
		.filter(Todo.category.in_(VACATION_TODO_CATEGORIES))
		.filter(Todo.start_date <= day_end)
		.filter(or_(Todo.end_date.is_(None), Todo.end_date >= day_start))
		.all()
	)


def _vacation_categories_for_day(db: Session, user_id: str, target_date: date) -> set[str]:
	# 인스턴스 필드도 Column[T]로 오탐될 수 있어 런타임 값은 str로 취급
	return {
		cast(str, t.category)
		for t in _vacation_todos_for_day(db, user_id, target_date)
		if t.category
	}


def check_clock_in_allowed(
	db: Session,
	user_id: str,
	current_time: datetime,
	*,
	confirm_full_day_vacation: bool = False,
	confirm_official_leave: bool = False,
) -> None:
	"""출근 가능 여부(update.md §2). 병가·경조·반차는 차단하지 않음. 종일 연차·공가는 확인 플래그 필요."""
	user = db.query(User).filter(User.user_login_id == user_id).first()
	if not user or user.join_date is None:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="입사일이 등록되지 않은 계정은 출근할 수 없습니다.",
		)

	today_date = current_time.date()
	record = get_today_attendance(db, user_id, today_date)

	if record and is_vacation_status(record.status) and record.clock_in_time is None:
		if not confirm_full_day_vacation:
			raise HTTPException(
				status_code=status.HTTP_409_CONFLICT,
				detail={
					"code": "VACATION_CONFIRM_REQUIRED",
					"message": "휴가로 등록된 날입니다. 출근 기록을 남기려면 확인 후 다시 시도해 주세요.",
				},
			)

	cats = _vacation_categories_for_day(db, user_id, today_date)
	if VACATION_TODO_REQUIRES_FULL_DAY_CONFIRM & cats and not confirm_full_day_vacation:
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail={
				"code": "VACATION_CONFIRM_REQUIRED",
				"message": "종일 연차(휴가) 일정이 있습니다. 확인 후 출근할 수 있습니다.",
			},
		)
	if VACATION_TODO_REQUIRES_OFFICIAL_LEAVE_CONFIRM & cats and not confirm_official_leave:
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail={
				"code": "OFFICIAL_LEAVE_CONFIRM_REQUIRED",
				"message": "공가 일정이 있습니다. 확인 후 출근 기록을 등록할 수 있습니다.",
			},
		)


def assert_user_can_clock_in(db: Session, user_id: str, current_time: datetime) -> None:
	"""레거시 호환: 확인 플래그 없이 검사(항상 종일 연차·공가·휴가 상태 행이 있으면 거절)."""
	check_clock_in_allowed(
		db,
		user_id,
		current_time,
		confirm_full_day_vacation=False,
		confirm_official_leave=False,
	)


def _append_official_leave_time_note(
	db: Session, user_id: str, work_date: date, ts: datetime, *, clock_out: bool = False
) -> None:
	"""공가 To-Do에 출근/퇴근 처리 시각 기록(update.md §2.4)."""
	todos = _vacation_todos_for_day(db, user_id, work_date)
	label = "퇴근처리" if clock_out else "출근처리"
	tag = f"[{label} {ts.strftime('%Y-%m-%d %H:%M')}]"
	for t in todos:
		if t.category != "official_leave":
			continue
		desc = (t.description or "").strip()
		if tag in desc:
			continue
		t.description = f"{desc}\n{tag}".strip() if desc else tag


# 1. 특정 날짜의 내 출퇴근 기록 조회
def get_today_attendance(db: Session, user_id: str, today_date: date):
	"""오늘 날짜와 사용자 ID로 기존 출퇴근 레코드가 있는지 확인합니다."""
	return (
		db.query(Attendance)
		.filter(Attendance.user_id == user_id, Attendance.work_date == today_date)
		.first()
	)


def get_clock_context(db: Session, user_id: str, work_date: date) -> dict[str, Any]:
	"""출퇴근 UI용 당일 맥락(확인 팝업 분기). 주말·공휴일은 DB holidays 기준."""
	cats = _vacation_categories_for_day(db, user_id, work_date)
	rec = get_today_attendance(db, user_id, work_date)
	requires_full = bool(VACATION_TODO_REQUIRES_FULL_DAY_CONFIRM & cats)
	if rec and is_vacation_status(rec.status) and rec.clock_in_time is None:
		requires_full = True
	h = (
		db.query(Holiday)
		.filter(Holiday.holiday_date == work_date)
		.first()
	)
	return {
		"work_date": work_date,
		"requires_full_day_vacation_confirm": requires_full,
		"requires_official_leave_confirm": bool(VACATION_TODO_REQUIRES_OFFICIAL_LEAVE_CONFIRM & cats),
		"has_half_day_vacation": ("vacation_am" in cats or "vacation_pm" in cats),
		"has_sick_or_special_vacation": ("vacation_sick" in cats or "vacation_special" in cats),
		"is_weekend": work_date.weekday() >= 5,
		"is_public_holiday": h is not None,
		"holiday_name": h.holiday_name if h else None,
	}


# 2. 출근 데이터 생성 (Create)
def create_clock_in(
	db: Session,
	user_id: str,
	current_time: datetime,
	status: str,
	location: str,
	lat: float,
	lng: float,
	note: str | None = None,
	*,
	confirm_full_day_vacation: bool = False,
	confirm_official_leave: bool = False,
):
	"""새로운 출퇴근 레코드를 생성하고 출근 정보를 기록합니다."""
	check_clock_in_allowed(
		db,
		user_id,
		current_time,
		confirm_full_day_vacation=confirm_full_day_vacation,
		confirm_official_leave=confirm_official_leave,
	)

	existing = get_today_attendance(db, user_id, current_time.date())
	if existing and existing.clock_in_time is not None:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="이미 출근 기록이 존재합니다.",
		)

	if existing and existing.clock_in_time is None:
		rec: Any = existing
		rec.clock_in_time = current_time
		rec.clock_in_location = location
		rec.clock_in_lat = lat
		rec.clock_in_lng = lng
		rec.status = status
		if note:
			rec.note = note
		_append_official_leave_time_note(db, user_id, current_time.date(), current_time, clock_out=False)
		db.commit()
		db.refresh(rec)
		return rec

	new_record = Attendance(
		user_id=user_id,
		work_date=current_time.date(),
		clock_in_time=current_time,
		clock_in_location=location,
		clock_in_lat=lat,
		clock_in_lng=lng,
		status=status,
		note=note,
	)
	db.add(new_record)
	_append_official_leave_time_note(db, user_id, current_time.date(), current_time, clock_out=False)
	db.commit()
	db.refresh(new_record)
	return new_record


# 3. 퇴근 데이터 업데이트 (Update)
def update_clock_out(
	db: Session,
	record: Attendance,
	current_time: datetime,
	status: str,
	location: str,
	lat: float,
	lng: float,
	note: str | None = None,
):
	"""기존 레코드에 퇴근 정보를 업데이트하고 총 근무 시간을 계산합니다."""
	# Column[...] 인스턴스 필드 대입·조건 오탐 방지 (이 함수 범위만 Any)
	rec: Any = record
	rec.clock_out_time = current_time
	rec.clock_out_location = location
	rec.clock_out_lat = lat
	rec.clock_out_lng = lng

	if note:
		rec.note = note

	if rec.clock_in_time is None:
		rec.work_minutes = 0
	else:
		time_diff = current_time - rec.clock_in_time
		total_minutes = max(0, int(time_diff.total_seconds() / 60))
		if total_minutes >= 480:
			total_minutes = max(0, total_minutes - 60)
		rec.work_minutes = total_minutes
	rec.status = status

	_append_official_leave_time_note(db, str(rec.user_id), rec.work_date, current_time, clock_out=True)

	db.commit()
	db.refresh(rec)
	return rec
