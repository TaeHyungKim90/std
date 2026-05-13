"""일별 근태 요약(다세션 합산) 단위 테스트."""

from datetime import date, datetime, time

from constants.attendance_shift import SHIFT_STATUS_CLOSED, SHIFT_STATUS_IN_PROGRESS
from models.auth_models import User
from models.hr_models import Attendance, AttendanceDailySummary
from services.hr.attendance_daily_summary_service import refresh_attendance_daily_summary
from support.memory_db import memory_db_session


def test_refresh_daily_summary_two_sessions_overtime():
	d = date(2026, 3, 10)
	with memory_db_session() as db:
		db.add(
			User(
				id=1,
				user_login_id="sum_user",
				user_password="x",
				user_name="Sum User",
				join_date=date(2020, 1, 1),
			)
		)
		db.commit()
		for i, (cin_h, cout_h, wm) in enumerate([(9, 13, 240), (14, 22, 360)]):
			db.add(
				Attendance(
					user_id="sum_user",
					work_date=d,
					clock_in_time=datetime.combine(d, time(cin_h, 0)),
					clock_out_time=datetime.combine(d, time(cout_h, 0)),
					status="NORMAL",
					work_minutes=wm,
					night_work_minutes=0,
					shift_status=SHIFT_STATUS_CLOSED,
				)
			)
		db.commit()

		refresh_attendance_daily_summary(db, "sum_user", d)
		row = db.query(AttendanceDailySummary).filter_by(user_id="sum_user", work_date=d).one()
		assert row.total_work_minutes == 600
		assert row.overtime_minutes == 120
		assert row.total_night_minutes == 0


def test_refresh_ignores_open_session():
	d = date(2026, 3, 11)
	with memory_db_session() as db:
		db.add(
			User(
				id=1,
				user_login_id="open_user",
				user_password="x",
				user_name="Open User",
				join_date=date(2020, 1, 1),
			)
		)
		db.commit()
		db.add(
			Attendance(
				user_id="open_user",
				work_date=d,
				clock_in_time=datetime.combine(d, time(9, 0)),
				clock_out_time=None,
				status="NORMAL",
				work_minutes=0,
				night_work_minutes=0,
				shift_status=SHIFT_STATUS_IN_PROGRESS,
			)
		)
		db.commit()
		refresh_attendance_daily_summary(db, "open_user", d)
		row = db.query(AttendanceDailySummary).filter_by(user_id="open_user", work_date=d).one()
		assert row.total_work_minutes == 0
