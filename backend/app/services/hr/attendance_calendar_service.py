from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, time, timedelta
from typing import Any, Iterable, cast

from sqlalchemy import or_
from sqlalchemy.orm import Session

from constants.vacation_categories import VACATION_TODO_CATEGORIES
from models.holiday_models import Holiday
from models.hr_models import Attendance, Todo
from services.tenant_scope import attendance_in_tenant, todos_in_tenant


_VACATION_LABELS: dict[str, str] = {
	"vacation_full": "연차",
	"official_leave": "공가",
	"vacation_am": "오전반차",
	"vacation_pm": "오후반차",
	"vacation_sick": "병가",
	"vacation_special": "경조휴가",
}


def month_bounds(year: int, month: int) -> tuple[date, date]:
	if month < 1 or month > 12:
		raise ValueError("month must be between 1 and 12")
	last_day = monthrange(year, month)[1]
	return date(year, month, 1), date(year, month, last_day)


def iter_days(start_d: date, end_d: date) -> Iterable[date]:
	cur = start_d
	while cur <= end_d:
		yield cur
		cur += timedelta(days=1)


def vacation_summary(day_todos: list[Todo]) -> str | None:
	cats = {str(t.category) for t in day_todos if t.category}
	labels = [
		label
		for key, label in _VACATION_LABELS.items()
		if key in cats
	]
	return ", ".join(labels) if labels else None


def build_month_context(
	db: Session,
	tenant_id: int,
	user_ids: list[str],
	start_d: date,
	end_d: date,
) -> dict[str, Any]:
	if not user_ids:
		return {
			"records_by_user_day": {},
			"todos_by_user_day": {},
			"holiday_by_date": {},
		}

	records = (
		attendance_in_tenant(db, tenant_id)
		.filter(Attendance.user_id.in_(user_ids))
		.filter(Attendance.work_date >= start_d, Attendance.work_date <= end_d)
		.order_by(Attendance.work_date.asc(), Attendance.clock_in_time.asc(), Attendance.id.asc())
		.all()
	)
	records_by_user_day: dict[str, dict[date, list[Attendance]]] = {}
	for record in records:
		uid = str(record.user_id)
		wd = cast(date, record.work_date)
		records_by_user_day.setdefault(uid, {}).setdefault(wd, []).append(record)

	day_start = datetime.combine(start_d, time.min)
	day_end = datetime.combine(end_d, time.max)
	todos = (
		todos_in_tenant(db, tenant_id)
		.filter(Todo.user_id.in_(user_ids))
		.filter(Todo.category.in_(VACATION_TODO_CATEGORIES))
		.filter(Todo.start_date <= day_end)
		.filter(or_(Todo.end_date.is_(None), Todo.end_date >= day_start))
		.all()
	)
	todos_by_user_day: dict[str, dict[date, list[Todo]]] = {}
	for todo in todos:
		uid = str(todo.user_id)
		first = max(start_d, todo.start_date.date())
		last = min(end_d, (todo.end_date or todo.start_date).date())
		for day in iter_days(first, last):
			todos_by_user_day.setdefault(uid, {}).setdefault(day, []).append(todo)

	holiday_rows = (
		db.query(Holiday.holiday_date, Holiday.holiday_name)
		.filter(Holiday.tenant_id == tenant_id)
		.filter(Holiday.holiday_date >= start_d, Holiday.holiday_date <= end_d)
		.all()
	)
	holiday_by_date = {row[0]: row[1] for row in holiday_rows}

	return {
		"records_by_user_day": records_by_user_day,
		"todos_by_user_day": todos_by_user_day,
		"holiday_by_date": holiday_by_date,
	}


def summarize_attendance_records(records: list[Attendance]) -> dict[str, Any]:
	clock_in_times = [r.clock_in_time for r in records if r.clock_in_time is not None]
	clock_out_times = [r.clock_out_time for r in records if r.clock_out_time is not None]
	has_clock_in = bool(clock_in_times)
	has_clock_out = bool(clock_out_times)
	return {
		"has_clock_in": has_clock_in,
		"has_clock_out": has_clock_out,
		"is_complete": has_clock_in and has_clock_out,
		"first_clock_in": min(clock_in_times) if clock_in_times else None,
		"last_clock_out": max(clock_out_times) if clock_out_times else None,
	}


def get_user_monthly_stamps(db: Session, tenant_id: int, user_id: str, year: int, month: int) -> dict[str, Any]:
	start_d, end_d = month_bounds(year, month)
	ctx = build_month_context(db, tenant_id, [user_id], start_d, end_d)
	records_by_day = ctx["records_by_user_day"].get(user_id, {})
	todos_by_day = ctx["todos_by_user_day"].get(user_id, {})

	items: list[dict[str, Any]] = []
	for day in iter_days(start_d, end_d):
		day_todos = todos_by_day.get(day, [])
		vac_label = vacation_summary(day_todos)
		records = records_by_day.get(day, [])
		att = summarize_attendance_records(records)

		if vac_label:
			stamp_type = "vacation"
			label = f"휴가 도장 완료 ({vac_label})"
			image_key = "vacation"
		elif att["is_complete"]:
			stamp_type = "attendance_complete"
			label = "출근/퇴근 도장 완료"
			image_key = "attendance_complete"
		elif att["has_clock_in"]:
			stamp_type = "clock_in"
			label = "출근 도장"
			image_key = "clock_in"
		elif att["has_clock_out"]:
			stamp_type = "clock_out"
			label = "퇴근 도장"
			image_key = "clock_out"
		else:
			continue

		items.append(
			{
				"work_date": day,
				"stamp_type": stamp_type,
				"label": label,
				"image_key": image_key,
				"has_clock_in": bool(att["has_clock_in"]),
				"has_clock_out": bool(att["has_clock_out"]),
				"is_vacation": bool(vac_label),
				"vacation_label": vac_label,
				"clock_in_time": att["first_clock_in"],
				"clock_out_time": att["last_clock_out"],
			}
		)

	return {"year": year, "month": month, "items": items}
