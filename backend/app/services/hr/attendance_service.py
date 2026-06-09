from datetime import date, datetime, time, timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from constants.attendance_shift import SHIFT_STATUS_CLOSED, SHIFT_STATUS_IN_PROGRESS
from constants.vacation_categories import (
	VACATION_TODO_CATEGORIES,
	VACATION_TODO_REQUIRES_FULL_DAY_CONFIRM,
	VACATION_TODO_REQUIRES_OFFICIAL_LEAVE_CONFIRM,
	VACATION_STATUS_KEYWORDS,
)
from models.hr_models import Attendance, Todo
from models.auth_models import User
from models.holiday_models import Holiday
from models.system_models import WorkLocation
from services.hr.attendance_daily_summary_service import refresh_attendance_daily_summary
from services.hr.attendance_time_math import app_break_tier_config, session_minutes_at_clock_out


def is_vacation_status(status_str: str | None) -> bool:
	"""Attendance.status 문자열 기반 휴가 키워드 판별."""
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


def sync_shift_status_from_clock_times(record: Attendance) -> None:
	"""clock_in / clock_out 조합에 맞춰 shift_status 정합성 유지."""
	if record.clock_in_time is not None and record.clock_out_time is None:
		record.shift_status = SHIFT_STATUS_IN_PROGRESS
	else:
		record.shift_status = SHIFT_STATUS_CLOSED


def get_open_shift(db: Session, user_id: str) -> Attendance | None:
	"""퇴근 미처리 근무(출근 있음·퇴근 없음). 사용자당 1건 가정, 최근 출근 순."""
	return (
		db.query(Attendance)
		.filter(
			Attendance.user_id == user_id,
			Attendance.clock_in_time.isnot(None),
			Attendance.clock_out_time.is_(None),
		)
		.order_by(Attendance.clock_in_time.desc())
		.first()
	)


def get_today_or_open_attendance(db: Session, user_id: str, today_date: date) -> Attendance | None:
	"""GET /today용: 미종료 야근이 있으면 그 행을, 없으면 당일 work_date 행을 반환."""
	open_rec = get_open_shift(db, user_id)
	if open_rec is not None:
		return open_rec
	return get_today_attendance(db, user_id, today_date)


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


def get_active_work_locations(db: Session) -> list[WorkLocation]:
	return (
		db.query(WorkLocation)
		.filter(WorkLocation.is_active.is_(True))
		.order_by(WorkLocation.created_at.desc(), WorkLocation.id.desc())
		.all()
	)


def _active_work_location_keys(db: Session) -> set[str]:
	return {str(w.location_key).strip() for w in get_active_work_locations(db)}


def resolve_work_location_token_to_key(db: Session, token: str) -> str:
	"""활성 근무장소의 location_key 또는 location_value로 들어온 토큰을 location_key로 정규화."""
	raw = (token or "").strip()
	if not raw:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="근무장소를 입력해 주세요.")
	for w in get_active_work_locations(db):
		k = str(w.location_key).strip()
		v = str(w.location_value).strip()
		if raw == k or raw == v:
			return k
	raise HTTPException(
		status_code=status.HTTP_400_BAD_REQUEST,
		detail="등록되지 않았거나 비활성인 근무장소입니다.",
	)


def format_stored_work_location_for_display(db: Session, stored: str | None) -> str | None:
	"""DB에 저장된 location_key(또는 레거시 value)를 화면 표시용 location_value로 바꿈. 없으면 원문 유지."""
	if stored is None:
		return None
	s = str(stored).strip()
	if not s:
		return None
	w = (
		db.query(WorkLocation)
		.filter(WorkLocation.location_key == s)
		.order_by(WorkLocation.id.desc())
		.first()
	)
	if w is not None:
		return str(w.location_value).strip()
	w = (
		db.query(WorkLocation)
		.filter(WorkLocation.location_value == s)
		.order_by(WorkLocation.id.desc())
		.first()
	)
	if w is not None:
		return str(w.location_value).strip()
	return s


def backfill_legacy_work_location_values_to_keys(db: Session) -> None:
	"""attendance·users에 남아 있는 활성 근무장소의 표시 문자열을 location_key로 치환."""
	active = get_active_work_locations(db)
	if not active:
		return
	value_to_key = {str(w.location_value).strip(): str(w.location_key).strip() for w in active}
	keys = {str(w.location_key).strip() for w in active}
	changed = False
	for a in db.query(Attendance).all():
		for attr in ("clock_in_location", "clock_out_location"):
			val = getattr(a, attr)
			if val is None:
				continue
			s = str(val).strip()
			if s in keys:
				continue
			nk = value_to_key.get(s)
			if nk and nk != s:
				setattr(a, attr, nk)
				changed = True
	for u in db.query(User).filter(User.preferred_work_location.isnot(None)).all():
		s = str(u.preferred_work_location).strip()
		if s in keys:
			continue
		nk = value_to_key.get(s)
		if nk and nk != s:
			u.preferred_work_location = nk
			changed = True
	if changed:
		db.commit()


def _apply_user_preferred_work_location(db: Session, user_login_id: str, location_key: str) -> None:
	"""활성 근무장소의 location_key일 때만 users.preferred_work_location 갱신(동일 트랜잭션 내)."""
	key = (location_key or "").strip()
	if not key or key not in _active_work_location_keys(db):
		return
	user = db.query(User).filter(User.user_login_id == user_login_id).first()
	if user:
		user.preferred_work_location = key


def set_user_preferred_work_location(db: Session, user_login_id: str, location_name: str) -> str:
	"""선호 근무장소를 location_key로 저장. 요청은 key 또는 활성 location_value."""
	key = resolve_work_location_token_to_key(db, location_name)
	user = db.query(User).filter(User.user_login_id == user_login_id).first()
	if not user:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다.")
	user.preferred_work_location = key
	db.commit()
	return key


def _vacation_categories_for_day(db: Session, user_id: str, target_date: date) -> set[str]:
	return {
		t.category
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
	"""동일 work_date 중 가장 최근(id desc) 세션 1건. 다회 출근 시 마지막 행."""
	return (
		db.query(Attendance)
		.filter(Attendance.user_id == user_id, Attendance.work_date == today_date)
		.order_by(Attendance.id.desc())
		.first()
	)


def list_attendance_sessions_for_work_date(db: Session, user_id: str, work_date: date) -> list[Attendance]:
	"""당일 근태 행 전부(다회 출근·세션 순서)."""
	return (
		db.query(Attendance)
		.filter(Attendance.user_id == user_id, Attendance.work_date == work_date)
		.order_by(Attendance.id.asc())
		.all()
	)


def _build_clock_context_payload(
	work_date: date,
	cats: set[str],
	rec: Attendance | None,
	holiday: Holiday | None,
	pref_loc: str | None,
) -> dict[str, Any]:
	requires_full = bool(VACATION_TODO_REQUIRES_FULL_DAY_CONFIRM & cats)
	if rec and is_vacation_status(rec.status) and rec.clock_in_time is None:
		requires_full = True
	return {
		"work_date": work_date,
		"requires_full_day_vacation_confirm": requires_full,
		"requires_official_leave_confirm": bool(VACATION_TODO_REQUIRES_OFFICIAL_LEAVE_CONFIRM & cats),
		"has_half_day_vacation": ("vacation_am" in cats or "vacation_pm" in cats),
		"has_sick_or_special_vacation": ("vacation_sick" in cats or "vacation_special" in cats),
		"is_weekend": work_date.weekday() >= 5,
		"is_public_holiday": holiday is not None,
		"holiday_name": holiday.holiday_name if holiday else None,
		"preferred_work_location": pref_loc,
	}


def _vacation_categories_on_day(vacation_todos: list[Todo], work_date: date) -> set[str]:
	day_start = datetime.combine(work_date, time.min)
	day_end = datetime.combine(work_date, time.max)
	cats: set[str] = set()
	for todo in vacation_todos:
		if todo.start_date <= day_end and (todo.end_date is None or todo.end_date >= day_start):
			if todo.category:
				cats.add(todo.category)
	return cats


def get_clock_context(db: Session, user_id: str, work_date: date) -> dict[str, Any]:
	"""출퇴근 UI용 당일 맥락(확인 팝업 분기). 주말·공휴일은 DB holidays 기준."""
	cats = _vacation_categories_for_day(db, user_id, work_date)
	rec = get_today_attendance(db, user_id, work_date)
	h = (
		db.query(Holiday)
		.filter(Holiday.holiday_date == work_date)
		.first()
	)
	user_row = db.query(User).filter(User.user_login_id == user_id).first()
	pref_loc: str | None = None
	if user_row is not None and getattr(user_row, "preferred_work_location", None):
		pref_loc = str(user_row.preferred_work_location).strip() or None
	return _build_clock_context_payload(work_date, cats, rec, h, pref_loc)


def get_clock_context_range(
	db: Session,
	user_id: str,
	date_from: date,
	date_to: date,
	*,
	max_days: int = 62,
) -> list[dict[str, Any]]:
	"""기간별 clock-context 일괄 조회(보고서 캘린더용 — N회 API 대신 1회 DB 세션)."""
	if date_from > date_to:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="date_from은 date_to보다 늦을 수 없습니다.",
		)
	if (date_to - date_from).days > max_days:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=f"조회 기간은 최대 {max_days}일까지 가능합니다.",
		)

	range_start = datetime.combine(date_from, time.min)
	range_end = datetime.combine(date_to, time.max)
	vacation_todos = (
		db.query(Todo)
		.filter(Todo.user_id == user_id)
		.filter(Todo.category.in_(VACATION_TODO_CATEGORIES))
		.filter(Todo.start_date <= range_end)
		.filter(or_(Todo.end_date.is_(None), Todo.end_date >= range_start))
		.all()
	)
	holidays = {
		h.holiday_date: h
		for h in db.query(Holiday)
		.filter(Holiday.holiday_date >= date_from, Holiday.holiday_date <= date_to)
		.all()
	}
	attendance_rows = (
		db.query(Attendance)
		.filter(Attendance.user_id == user_id)
		.filter(Attendance.work_date >= date_from, Attendance.work_date <= date_to)
		.order_by(Attendance.work_date.asc(), Attendance.id.desc())
		.all()
	)
	att_by_date: dict[date, Attendance] = {}
	for row in attendance_rows:
		wd = row.work_date
		if wd is not None and wd not in att_by_date:
			att_by_date[wd] = row

	user_row = db.query(User).filter(User.user_login_id == user_id).first()
	pref_loc: str | None = None
	if user_row is not None and getattr(user_row, "preferred_work_location", None):
		pref_loc = str(user_row.preferred_work_location).strip() or None

	items: list[dict[str, Any]] = []
	cursor = date_from
	while cursor <= date_to:
		cats = _vacation_categories_on_day(vacation_todos, cursor)
		items.append(
			_build_clock_context_payload(
				cursor,
				cats,
				att_by_date.get(cursor),
				holidays.get(cursor),
				pref_loc,
			)
		)
		cursor += timedelta(days=1)
	return items


# 2. 출근 데이터 생성 (Create)
def create_clock_in(
	db: Session,
	user_id: str,
	current_time: datetime,
	record_status: str,
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

	if get_open_shift(db, user_id) is not None:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="미종료 근무가 있습니다. 먼저 퇴근 처리한 뒤 출근할 수 있습니다.",
		)

	day_rows = list_attendance_sessions_for_work_date(db, user_id, current_time.date())
	incomplete_same_day = [r for r in day_rows if r.clock_in_time is not None and r.clock_out_time is None]
	if incomplete_same_day:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="미종료 근무가 있습니다. 먼저 퇴근 처리한 뒤 출근할 수 있습니다.",
		)

	location_key = resolve_work_location_token_to_key(db, location)

	placeholder = next((r for r in day_rows if r.clock_in_time is None), None)
	if placeholder is not None:
		rec = placeholder
		rec.clock_in_time = current_time
		rec.clock_in_location = location_key
		rec.clock_in_lat = lat
		rec.clock_in_lng = lng
		rec.status = record_status
		rec.shift_status = SHIFT_STATUS_IN_PROGRESS
		if note:
			rec.note = note
		_append_official_leave_time_note(db, user_id, current_time.date(), current_time, clock_out=False)
		_apply_user_preferred_work_location(db, user_id, location_key)
		db.commit()
		db.refresh(rec)
		return rec

	new_record = Attendance(
		user_id=user_id,
		work_date=current_time.date(),
		clock_in_time=current_time,
		clock_in_location=location_key,
		clock_in_lat=lat,
		clock_in_lng=lng,
		status=record_status,
		note=note,
		shift_status=SHIFT_STATUS_IN_PROGRESS,
	)
	db.add(new_record)
	_append_official_leave_time_note(db, user_id, current_time.date(), current_time, clock_out=False)
	_apply_user_preferred_work_location(db, user_id, location_key)
	db.commit()
	db.refresh(new_record)
	return new_record


# 3. 퇴근 데이터 업데이트 (Update)
def update_clock_out(
	db: Session,
	record: Attendance,
	current_time: datetime,
	record_status: str,
	location: str,
	lat: float,
	lng: float,
	note: str | None = None,
):
	"""기존 레코드에 퇴근 정보를 업데이트하고 총 근무 시간을 계산합니다."""
	location_key = resolve_work_location_token_to_key(db, location)
	record.clock_out_time = current_time
	record.clock_out_location = location_key
	record.clock_out_lat = lat
	record.clock_out_lng = lng

	if note:
		record.note = note

	if record.clock_in_time is None:
		record.work_minutes = 0
		record.night_work_minutes = 0
	else:
		cfg = app_break_tier_config()
		session_m = session_minutes_at_clock_out(record.clock_in_time, current_time, cfg=cfg)
		record.work_minutes = session_m.work_minutes
		record.night_work_minutes = session_m.night_work_minutes
	record.status = record_status
	record.shift_status = SHIFT_STATUS_CLOSED

	user_id = record.user_id or ""
	work_day = record.work_date
	if work_day is not None:
		_append_official_leave_time_note(db, user_id, work_day, current_time, clock_out=True)
		refresh_attendance_daily_summary(db, user_id, work_day)

	_apply_user_preferred_work_location(db, user_id, location_key)

	db.commit()
	db.refresh(record)
	return record
