"""동일 user·work_date 근태 CLOSED 세션 합산 → AttendanceDailySummary upsert."""

from datetime import date
from typing import Any, cast

from sqlalchemy.orm import Session

from constants.attendance_shift import SHIFT_STATUS_CLOSED
from core.config import settings
from models.hr_models import Attendance, AttendanceDailySummary
from services.hr.attendance_time_math import day_overtime_from_total_work


def refresh_attendance_daily_summary(db: Session, user_id: str, work_date: date) -> AttendanceDailySummary | None:
	"""해당일 CLOSED 세션만 합산해 요약 행을 갱신합니다. 세션이 없으면 기존 요약을 0으로 두거나 삭제하지 않고 0 갱신."""
	standard = int(settings.ATTENDANCE_STANDARD_WORKDAY_MINUTES)
	rows = (
		db.query(Attendance)
		.filter(
			Attendance.user_id == user_id,
			Attendance.work_date == work_date,
			Attendance.clock_in_time.isnot(None),
			Attendance.clock_out_time.isnot(None),
			Attendance.shift_status == SHIFT_STATUS_CLOSED,
		)
		.all()
	)
	total_work = 0
	total_night = 0
	for r in rows:
		ra: Any = r
		total_work += int(ra.work_minutes or 0)
		total_night += int(getattr(ra, "night_work_minutes", None) or 0)
	overtime = day_overtime_from_total_work(total_work, standard)

	existing = (
		db.query(AttendanceDailySummary)
		.filter(
			AttendanceDailySummary.user_id == user_id,
			AttendanceDailySummary.work_date == work_date,
		)
		.first()
	)
	if existing is None:
		row = AttendanceDailySummary(
			user_id=user_id,
			work_date=work_date,
			total_work_minutes=total_work,
			overtime_minutes=overtime,
			total_night_minutes=total_night,
		)
		db.add(row)
		db.flush()
		return row

	existing.total_work_minutes = total_work
	existing.overtime_minutes = overtime
	existing.total_night_minutes = total_night
	db.add(existing)
	db.flush()
	return cast(AttendanceDailySummary, existing)


def summary_dict_for_work_date(db: Session, user_id: str, work_date: date) -> dict[str, int] | None:
	"""GET 응답용: DB 요약이 없어도 CLOSED 세션으로 즉시 합산."""
	standard = int(settings.ATTENDANCE_STANDARD_WORKDAY_MINUTES)
	rows = (
		db.query(Attendance)
		.filter(
			Attendance.user_id == user_id,
			Attendance.work_date == work_date,
			Attendance.clock_in_time.isnot(None),
			Attendance.clock_out_time.isnot(None),
			Attendance.shift_status == SHIFT_STATUS_CLOSED,
		)
		.all()
	)
	if not rows:
		stored = (
			db.query(AttendanceDailySummary)
			.filter(
				AttendanceDailySummary.user_id == user_id,
				AttendanceDailySummary.work_date == work_date,
			)
			.first()
		)
		if stored is None:
			return None
		return {
			"total_work_minutes": int(stored.total_work_minutes or 0),
			"overtime_minutes": int(stored.overtime_minutes or 0),
			"total_night_minutes": int(stored.total_night_minutes or 0),
		}
	total_work = 0
	total_night = 0
	for r in rows:
		ra: Any = r
		total_work += int(ra.work_minutes or 0)
		total_night += int(getattr(ra, "night_work_minutes", None) or 0)
	return {
		"total_work_minutes": total_work,
		"overtime_minutes": day_overtime_from_total_work(total_work, standard),
		"total_night_minutes": total_night,
	}
