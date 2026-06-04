from __future__ import annotations

from datetime import date, datetime
from typing import Any, cast

from sqlalchemy import or_
from sqlalchemy.orm import Session

from core.config import settings
from models.auth_models import User
from services.tenant_scope import directory_users_in_tenant
from services.hr.attendance_calendar_service import (
	build_month_context,
	iter_days,
	month_bounds,
	summarize_attendance_records,
	vacation_summary,
)
from utils.seoul_time import now_seoul_naive, today_seoul


ATTENDANCE_COMPLETE_POINTS = 1
ON_TIME_POINTS = 1
VACATION_POINTS = 1


def _workday_start_minutes() -> int:
	hour, minute = settings.ATTENDANCE_WORKDAY_START.split(":")[:2]
	return int(hour) * 60 + int(minute)


def _time_to_minutes(dt: datetime) -> int:
	return dt.hour * 60 + dt.minute


def _is_on_time(first_clock_in: datetime | None) -> bool:
	if first_clock_in is None:
		return False
	return _time_to_minutes(first_clock_in) <= _workday_start_minutes()


def _active_users_for_month(db: Session, tenant_id: int, start_d: date, end_d: date) -> list[User]:
	return (
		directory_users_in_tenant(db, tenant_id)
		.filter(
			User.join_date.isnot(None),
			User.join_date <= end_d,
			or_(User.resignation_date == None, User.resignation_date >= start_d),  # noqa: E711
		)
		.order_by(User.user_name.asc(), User.user_login_id.asc())
		.all()
	)


def get_monthly_attendance_rewards(db: Session, tenant_id: int, year: int, month: int) -> dict[str, Any]:
	month_start, month_end = month_bounds(year, month)
	today = today_seoul()
	score_end = min(month_end, today)
	users = _active_users_for_month(db, tenant_id, month_start, month_end)
	user_ids = [str(u.user_login_id) for u in users]
	ctx = build_month_context(db, tenant_id, user_ids, month_start, score_end)
	records_by_user_day = ctx["records_by_user_day"]
	todos_by_user_day = ctx["todos_by_user_day"]
	holiday_by_date = ctx["holiday_by_date"]

	rows: list[dict[str, Any]] = []
	for user in users:
		uid = str(user.user_login_id)
		join_date = cast(date | None, user.join_date)
		resignation_date = cast(date | None, user.resignation_date)
		user_start = max(month_start, join_date) if join_date else month_start
		user_end = min(score_end, resignation_date) if resignation_date else score_end

		eligible_days = 0
		attendance_completed_days = 0
		vacation_days = 0
		on_time_days = 0
		score = 0
		current_streak = 0
		longest_streak = 0

		if user_start <= user_end:
			for day in iter_days(user_start, user_end):
				if day.weekday() >= 5 or day in holiday_by_date:
					continue
				eligible_days += 1
				day_todos = todos_by_user_day.get(uid, {}).get(day, [])
				vac_label = vacation_summary(day_todos)
				if vac_label:
					vacation_days += 1
					score += VACATION_POINTS
					current_streak += 1
					longest_streak = max(longest_streak, current_streak)
					continue

				records = records_by_user_day.get(uid, {}).get(day, [])
				att = summarize_attendance_records(records)
				if att["is_complete"]:
					attendance_completed_days += 1
					score += ATTENDANCE_COMPLETE_POINTS
					if _is_on_time(att["first_clock_in"]):
						on_time_days += 1
						score += ON_TIME_POINTS
					current_streak += 1
					longest_streak = max(longest_streak, current_streak)
				else:
					current_streak = 0

		rows.append(
			{
				"rank": 0,
				"user_id": uid,
				"user_name": str(user.user_name),
				"score": score,
				"attendance_completed_days": attendance_completed_days,
				"vacation_days": vacation_days,
				"on_time_days": on_time_days,
				"longest_streak_days": longest_streak,
				"eligible_days": eligible_days,
				"coupon_target": False,
			}
		)

	rows.sort(
		key=lambda row: (
			-int(row["score"]),
			-int(row["attendance_completed_days"]),
			-int(row["vacation_days"]),
			-int(row["on_time_days"]),
			str(row["user_name"]),
			str(row["user_id"]),
		)
	)
	for idx, row in enumerate(rows, start=1):
		row["rank"] = idx
	if rows and rows[0]["score"] > 0:
		rows[0]["coupon_target"] = True

	winner = rows[0] if rows and rows[0]["coupon_target"] else None
	return {
		"year": year,
		"month": month,
		"generated_at": now_seoul_naive(),
		"points_policy": {
			"attendance_complete": ATTENDANCE_COMPLETE_POINTS,
			"on_time": ON_TIME_POINTS,
			"vacation": VACATION_POINTS,
		},
		"winner": winner,
		"items": rows,
	}
