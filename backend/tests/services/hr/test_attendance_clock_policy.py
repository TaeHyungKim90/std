"""출근 정책·공가 메모 갱신 단위 테스트 (인메모리 SQLite)."""

from datetime import date, datetime, time, timedelta

import pytest
from fastapi import HTTPException

from constants.attendance_shift import SHIFT_STATUS_CLOSED, SHIFT_STATUS_IN_PROGRESS
from models.auth_models import User
from models.hr_models import Attendance, Todo
from services.hr import attendance_service as hr_att
from support.memory_db import memory_db_session
from utils.seoul_time import today_seoul


@pytest.fixture()
def db_session():
	with memory_db_session() as s:
		yield s


@pytest.fixture(autouse=True)
def seed_active_work_locations(db_session):
	from models.system_models import WorkLocation

	if db_session.query(WorkLocation).count() == 0:
		db_session.add_all(
			[
				WorkLocation(location_key="company", location_value="회사", is_active=True),
				WorkLocation(location_key="hq", location_value="본사", is_active=True),
			]
		)
		db_session.commit()


@pytest.fixture()
def user_joined(db_session):
	u = User(
		id=1,
		user_login_id="clock_user",
		user_password="x",
		user_name="Clock User",
		join_date=date(2020, 1, 1),
	)
	db_session.add(u)
	db_session.commit()
	return u


def _add_vacation_todo(db, user_id: str, category: str, d: date) -> None:
	st = datetime.combine(d, time.min)
	en = datetime.combine(d, time.max)
	db.add(
		Todo(
			user_id=user_id,
			title="pytest",
			start_date=st,
			end_date=en,
			category=category,
		)
	)
	db.commit()


def _dt(d: date, h: int = 9, m: int = 0) -> datetime:
	return datetime.combine(d, time(h, m))


def test_vacation_full_requires_confirm(db_session, user_joined):
	d = today_seoul()
	_add_vacation_todo(db_session, "clock_user", "vacation_full", d)
	with pytest.raises(HTTPException) as ei:
		hr_att.check_clock_in_allowed(
			db_session,
			"clock_user",
			_dt(d),
			confirm_full_day_vacation=False,
			confirm_official_leave=False,
		)
	assert ei.value.status_code == 409
	detail = ei.value.detail
	assert isinstance(detail, dict) and detail.get("code") == "VACATION_CONFIRM_REQUIRED"


def test_vacation_full_allowed_with_confirm(db_session, user_joined):
	d = today_seoul()
	_add_vacation_todo(db_session, "clock_user", "vacation_full", d)
	hr_att.check_clock_in_allowed(
		db_session,
		"clock_user",
		_dt(d),
		confirm_full_day_vacation=True,
		confirm_official_leave=False,
	)


def test_official_leave_requires_confirm(db_session, user_joined):
	d = today_seoul()
	_add_vacation_todo(db_session, "clock_user", "official_leave", d)
	with pytest.raises(HTTPException) as ei:
		hr_att.check_clock_in_allowed(
			db_session,
			"clock_user",
			_dt(d),
			confirm_full_day_vacation=False,
			confirm_official_leave=False,
		)
	assert ei.value.status_code == 409
	detail = ei.value.detail
	assert isinstance(detail, dict) and detail.get("code") == "OFFICIAL_LEAVE_CONFIRM_REQUIRED"


def test_vacation_sick_does_not_require_confirm(db_session, user_joined):
	d = today_seoul()
	_add_vacation_todo(db_session, "clock_user", "vacation_sick", d)
	hr_att.check_clock_in_allowed(
		db_session,
		"clock_user",
		_dt(d),
		confirm_full_day_vacation=False,
		confirm_official_leave=False,
	)


def test_half_day_todo_does_not_require_confirm(db_session, user_joined):
	d = today_seoul()
	_add_vacation_todo(db_session, "clock_user", "vacation_am", d)
	hr_att.check_clock_in_allowed(
		db_session,
		"clock_user",
		_dt(d),
		confirm_full_day_vacation=False,
		confirm_official_leave=False,
	)


def test_clock_in_appends_official_leave_note(db_session, user_joined):
	d = today_seoul()
	t = Todo(
		user_id="clock_user",
		title="공가",
		start_date=datetime.combine(d, time.min),
		end_date=datetime.combine(d, time.max),
		category="official_leave",
		description="원문",
	)
	db_session.add(t)
	db_session.commit()
	todo_id = t.id

	now = _dt(d, 10, 30)
	rec = hr_att.create_clock_in(
		db_session,
		"clock_user",
		now,
		record_status="NORMAL",
		location="본사",
		lat=37.0,
		lng=127.0,
		confirm_full_day_vacation=False,
		confirm_official_leave=True,
	)
	assert rec.clock_in_time is not None
	assert rec.shift_status == SHIFT_STATUS_IN_PROGRESS
	assert rec.clock_in_location == "hq"
	t2 = db_session.query(Todo).filter(Todo.id == todo_id).one()
	assert "출근처리" in (t2.description or "")
	assert "원문" in (t2.description or "")

	db_session.query(Attendance).filter(Attendance.id == rec.id).delete()
	db_session.query(Todo).filter(Todo.id == todo_id).delete()
	db_session.commit()


def test_clock_out_appends_official_leave_note(db_session, user_joined):
	d = today_seoul()
	t = Todo(
		user_id="clock_user",
		title="공가",
		start_date=datetime.combine(d, time.min),
		end_date=datetime.combine(d, time.max),
		category="official_leave",
		description="",
	)
	db_session.add(t)
	db_session.commit()
	todo_id = t.id
	cin = datetime.combine(d, time(9, 0))
	cout = datetime.combine(d, time(18, 0))
	rec = Attendance(
		user_id="clock_user",
		work_date=d,
		clock_in_time=cin,
		clock_out_time=None,
		status="NORMAL",
		work_minutes=0,
		night_work_minutes=0,
		shift_status=SHIFT_STATUS_IN_PROGRESS,
	)
	db_session.add(rec)
	db_session.commit()
	db_session.refresh(rec)

	hr_att.update_clock_out(
		db_session,
		rec,
		cout,
		record_status="NORMAL",
		location="본사",
		lat=37.0,
		lng=127.0,
	)
	db_session.refresh(rec)
	assert rec.shift_status == SHIFT_STATUS_CLOSED
	assert rec.clock_out_location == "hq"
	t2 = db_session.query(Todo).filter(Todo.id == todo_id).one()
	assert "퇴근처리" in (t2.description or "")

	db_session.query(Attendance).filter(Attendance.id == rec.id).delete()
	db_session.query(Todo).filter(Todo.id == todo_id).delete()
	db_session.commit()


def test_update_clock_out_sets_night_and_tiered_break(db_session, user_joined):
	d = today_seoul()
	d2 = d + timedelta(days=1)
	cin = datetime.combine(d, time(23, 55))
	cout = datetime.combine(d2, time(3, 55))
	rec = Attendance(
		user_id="clock_user",
		work_date=d,
		clock_in_time=cin,
		clock_out_time=None,
		status="NORMAL",
		work_minutes=0,
		night_work_minutes=0,
		shift_status=SHIFT_STATUS_IN_PROGRESS,
	)
	db_session.add(rec)
	db_session.commit()
	db_session.refresh(rec)

	hr_att.update_clock_out(
		db_session,
		rec,
		cout,
		record_status="NORMAL",
		location="본사",
		lat=37.0,
		lng=127.0,
	)
	db_session.refresh(rec)
	assert rec.night_work_minutes == 240
	assert rec.work_minutes == 210
	assert rec.clock_out_location == "hq"

	db_session.query(Attendance).filter(Attendance.id == rec.id).delete()
	db_session.commit()


def test_get_clock_context_flags(db_session, user_joined):
	from models.holiday_models import Holiday

	d = today_seoul()
	_add_vacation_todo(db_session, "clock_user", "vacation_full", d)
	_add_vacation_todo(db_session, "clock_user", "vacation_am", d)

	db_session.add(
		Holiday(holiday_date=d, holiday_name="테스트공휴일", is_official=True)
	)
	db_session.commit()

	ctx = hr_att.get_clock_context(db_session, "clock_user", d)
	assert ctx["requires_full_day_vacation_confirm"] is True
	assert ctx["has_half_day_vacation"] is True
	assert ctx["is_public_holiday"] is True
	assert ctx["holiday_name"] == "테스트공휴일"
	assert "preferred_work_location" in ctx
