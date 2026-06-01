from datetime import date, datetime, time

import pytest

from models.auth_models import User
from models.holiday_models import Holiday
from models.hr_models import Attendance, Todo
from services.admin import attendance_reward_service
from services.hr import attendance_calendar_service
from support.memory_db import memory_db_session


@pytest.fixture()
def db_session():
	with memory_db_session() as s:
		yield s


def _user(user_id: str, name: str) -> User:
	return User(
		user_login_id=user_id,
		tenant_id=1,
		user_password="x",
		user_name=name,
		join_date=date(2020, 1, 1),
	)


def _attendance(db, user_id: str, work_date: date, start: time, end: time | None) -> None:
	db.add(
		Attendance(
			user_id=user_id,
			work_date=work_date,
			clock_in_time=datetime.combine(work_date, start),
			clock_out_time=datetime.combine(work_date, end) if end else None,
			status="NORMAL",
			work_minutes=480 if end else 0,
		)
	)
	db.commit()


def _vacation(db, user_id: str, work_date: date, category: str = "vacation_full") -> None:
	db.add(
		Todo(
			user_id=user_id,
			title="휴가",
			start_date=datetime.combine(work_date, time.min),
			end_date=datetime.combine(work_date, time.max),
			category=category,
		)
	)
	db.commit()


def test_monthly_rewards_use_bonus_points_without_penalties(db_session):
	db_session.add_all([_user("alice", "앨리스"), _user("bob", "밥")])
	db_session.commit()

	_attendance(db_session, "alice", date(2024, 1, 2), time(8, 55), time(18, 0))
	_vacation(db_session, "alice", date(2024, 1, 3))
	_attendance(db_session, "alice", date(2024, 1, 4), time(9, 30), time(18, 0))
	_attendance(db_session, "bob", date(2024, 1, 2), time(8, 50), time(18, 0))
	_attendance(db_session, "bob", date(2024, 1, 3), time(9, 0), None)

	out = attendance_reward_service.get_monthly_attendance_rewards(db_session, 1, 2024, 1)
	alice = next(row for row in out["items"] if row["user_id"] == "alice")
	bob = next(row for row in out["items"] if row["user_id"] == "bob")

	assert alice["score"] == 4
	assert alice["attendance_completed_days"] == 2
	assert alice["vacation_days"] == 1
	assert alice["on_time_days"] == 1
	assert bob["score"] == 2
	assert bob["attendance_completed_days"] == 1
	assert bob["coupon_target"] is False
	assert out["winner"]["user_id"] == "alice"


def test_monthly_rewards_skip_public_holidays(db_session):
	db_session.add(_user("worker", "직원"))
	db_session.add(Holiday(tenant_id=1, holiday_date=date(2024, 1, 5), holiday_name="테스트공휴일", is_official=True))
	db_session.commit()
	_attendance(db_session, "worker", date(2024, 1, 5), time(8, 40), time(18, 0))

	out = attendance_reward_service.get_monthly_attendance_rewards(db_session, 1, 2024, 1)
	worker = next(row for row in out["items"] if row["user_id"] == "worker")

	assert worker["score"] == 0
	assert worker["eligible_days"] == 22
	assert out["winner"] is None


def test_employee_calendar_stamps_do_not_include_scores(db_session):
	db_session.add(_user("stamp_user", "도장사용자"))
	db_session.commit()
	_attendance(db_session, "stamp_user", date(2024, 1, 2), time(8, 55), time(18, 0))
	_vacation(db_session, "stamp_user", date(2024, 1, 3), "official_leave")

	out = attendance_calendar_service.get_user_monthly_stamps(db_session, 1, "stamp_user", 2024, 1)
	stamps = {row["work_date"]: row for row in out["items"]}

	assert stamps[date(2024, 1, 2)]["stamp_type"] == "attendance_complete"
	assert stamps[date(2024, 1, 3)]["stamp_type"] == "vacation"
	assert "score" not in stamps[date(2024, 1, 2)]
	assert "coupon_target" not in stamps[date(2024, 1, 3)]
