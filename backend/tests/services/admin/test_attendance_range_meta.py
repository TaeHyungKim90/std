"""관리자 기간 근태 조회: 휴가 요약·가상행(MISSING/ABSENT) 단위 테스트."""

from datetime import date, datetime, time, timedelta

import pytest

from models.auth_models import User
from models.hr_models import Attendance, Todo
from models.holiday_models import Holiday
from services.admin import attendance_service as admin_att
from support.memory_db import memory_db_session


@pytest.fixture()
def db_session():
	with memory_db_session() as s:
		yield s


@pytest.fixture()
def range_user(db_session):
	u = User(
		id=1,
		user_login_id="range_user",
		user_password="x",
		user_name="Range User",
		join_date=date(2020, 1, 1),
	)
	db_session.add(u)
	db_session.commit()
	return u


def _monday_on_or_before(d: date) -> date:
	return d - timedelta(days=d.weekday())


def _todo(db, uid: str, cat: str, d: date) -> None:
	st = datetime.combine(d, time.min)
	en = datetime.combine(d, time.max)
	db.add(Todo(user_id=uid, title="일정", start_date=st, end_date=en, category=cat))
	db.commit()


def _wd_eq(r: dict, d: date) -> bool:
	wd = r.get("work_date")
	if wd == d:
		return True
	if isinstance(wd, date):
		return wd.isoformat() == d.isoformat()
	return str(wd) == d.isoformat()


def test_half_day_no_attendance_yields_missing_explanation(db_session, range_user):
	"""반차 To-Do만 있고 근태 행이 없으면 MISSING_EXPLANATION 가상행."""
	mon = _monday_on_or_before(date.today() - timedelta(days=10))
	wed = mon + timedelta(days=2)
	assert wed.weekday() == 2
	_todo(db_session, "range_user", "vacation_am", wed)

	out = admin_att.get_user_attendance_range(
		db_session,
		"range_user",
		mon.isoformat(),
		(mon + timedelta(days=4)).isoformat(),
	)
	synthetic = [r for r in out["items"] if _wd_eq(r, wed)]
	missing = [r for r in synthetic if r.get("status") == "MISSING_EXPLANATION"]
	assert len(missing) == 1
	assert missing[0].get("note") == "HALF_DAY_PENDING"
	assert "오전반차" in (missing[0].get("vacation_todo_summary") or "")


def test_vacation_full_skips_absent_virtual(db_session, range_user):
	"""종일 연차일·무기록이면 결근 가상행을 만들지 않음."""
	mon = _monday_on_or_before(date.today() - timedelta(days=10))
	tue = mon + timedelta(days=1)
	_todo(db_session, "range_user", "vacation_full", tue)

	out = admin_att.get_user_attendance_range(
		db_session,
		"range_user",
		mon.isoformat(),
		(mon + timedelta(days=4)).isoformat(),
	)
	dates_in_items = []
	for r in out["items"]:
		wd = r["work_date"]
		dates_in_items.append(wd.isoformat() if hasattr(wd, "isoformat") else str(wd))
	assert tue.isoformat() not in dates_in_items


def test_sick_todo_weekday_no_record_yields_auto_absent(db_session, range_user):
	mon = _monday_on_or_before(date.today() - timedelta(days=10))
	thu = mon + timedelta(days=3)
	assert thu.weekday() == 3
	_todo(db_session, "range_user", "vacation_sick", thu)

	out = admin_att.get_user_attendance_range(
		db_session,
		"range_user",
		mon.isoformat(),
		(mon + timedelta(days=4)).isoformat(),
	)
	absent = [
		r
		for r in out["items"]
		if _wd_eq(r, thu) and r.get("status") == "ABSENT" and r.get("note") == "AUTO_ABSENT"
	]
	assert len(absent) == 1
	assert "병가" in (absent[0].get("vacation_todo_summary") or "")


def test_real_row_merged_with_vacation_summary(db_session, range_user):
	mon = _monday_on_or_before(date.today() - timedelta(days=10))
	fri = mon + timedelta(days=4)
	assert fri.weekday() == 4
	_todo(db_session, "range_user", "vacation_pm", fri)
	ci = datetime.combine(fri, time(9, 0))
	db_session.add(
		Attendance(
			user_id="range_user",
			work_date=fri,
			clock_in_time=ci,
			clock_out_time=None,
			status="NORMAL",
			work_minutes=0,
		)
	)
	db_session.commit()

	out = admin_att.get_user_attendance_range(
		db_session,
		"range_user",
		mon.isoformat(),
		fri.isoformat(),
	)
	row = next(r for r in out["items"] if _wd_eq(r, fri) and r.get("id", 0) > 0)
	assert "오후반차" in (row.get("vacation_todo_summary") or "")
	assert row.get("half_day_type") == "pm"
	assert row.get("review_hint") == "HALF_DAY_NEEDS_REVIEW"


def test_weekend_half_day_no_attendance_yields_missing(db_session, range_user):
	"""주말에도 반차 To-Do는 MISSING 가상행으로 병기(§1.5)."""
	mon = _monday_on_or_before(date.today() - timedelta(days=10))
	sat = mon + timedelta(days=5)
	assert sat.weekday() == 5
	_todo(db_session, "range_user", "vacation_pm", sat)

	out = admin_att.get_user_attendance_range(
		db_session,
		"range_user",
		mon.isoformat(),
		(mon + timedelta(days=6)).isoformat(),
	)
	missing = [r for r in out["items"] if _wd_eq(r, sat) and r.get("status") == "MISSING_EXPLANATION"]
	assert len(missing) == 1


def test_public_holiday_row_has_name(db_session, range_user):
	mon = _monday_on_or_before(date.today() - timedelta(days=10))
	wed = mon + timedelta(days=2)
	db_session.add(Holiday(holiday_date=wed, holiday_name="임시공휴일", is_official=True))
	ci = datetime.combine(wed, time(10, 0))
	db_session.add(
		Attendance(
			user_id="range_user",
			work_date=wed,
			clock_in_time=ci,
			status="NORMAL",
			work_minutes=0,
		)
	)
	db_session.commit()

	out = admin_att.get_user_attendance_range(
		db_session,
		"range_user",
		wed.isoformat(),
		wed.isoformat(),
	)
	assert len(out["items"]) == 1
	row = out["items"][0]
	assert row.get("is_public_holiday") is True
	assert row.get("holiday_name") == "임시공휴일"
