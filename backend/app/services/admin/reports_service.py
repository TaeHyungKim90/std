from datetime import date, datetime, time, timedelta
from typing import cast

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from constants.vacation_categories import VACATION_TODO_CATEGORIES
from models.auth_models import User
from services.tenant_scope import (
	attendance_in_tenant,
	daily_reports_in_tenant,
	directory_users_in_tenant,
	monthly_reports_in_tenant,
	todos_in_tenant,
	weekly_reports_in_tenant,
)
from models.holiday_models import Holiday
from models.hr_models import Attendance, DailyReport, MonthlyReport, Todo, WeeklyReport
from services.hr import reports_service as hr_reports
from services.hr.attendance_service import is_vacation_status
from services.tenant_scope import require_user_by_login_id


def _is_weekend(d: date) -> bool:
	return d.weekday() >= 5


def _is_public_holiday(db: Session, tenant_id: int, work_date: date) -> bool:
	return (
		db.query(Holiday.id)
		.filter(Holiday.tenant_id == tenant_id, Holiday.holiday_date == work_date)
		.first()
		is not None
	)


def list_daily_status(db: Session, tenant_id: int, work_date: date) -> list[dict]:
	"""일일보고 현황: 휴일 → 휴가(근태/일정) → 작성완료/미작성 순으로 판별."""
	users = (
		directory_users_in_tenant(db, tenant_id)
		.filter(User.join_date.isnot(None))
		.filter(User.join_date <= work_date)
		# 기준일(work_date) 이전에 퇴사한 직원은 제외 (퇴사일이 기준일 이상이면 포함)
		.filter(or_(User.resignation_date.is_(None), User.resignation_date >= work_date))
		.order_by(User.user_name.asc())
		.all()
	)

	holiday_or_weekend = _is_weekend(work_date) or _is_public_holiday(db, tenant_id, work_date)

	att_by_user = {
		a.user_id: a
		for a in attendance_in_tenant(db, tenant_id)
		.filter(Attendance.work_date == work_date)
		.all()
	}
	report_by_user = {
		r.user_id: r
		for r in daily_reports_in_tenant(db, tenant_id)
		.filter(DailyReport.report_date == work_date)
		.all()
	}

	day_start = datetime.combine(work_date, time.min)
	day_end = datetime.combine(work_date, time.max)
	vac_todo_rows = (
		todos_in_tenant(db, tenant_id)
		.with_entities(Todo.user_id)
		.filter(Todo.category.in_(VACATION_TODO_CATEGORIES))
		.filter(Todo.start_date <= day_end)
		.filter(or_(Todo.end_date.is_(None), Todo.end_date >= day_start))
		.distinct()
		.all()
	)
	vacation_todo_users = {cast(str, row[0]) for row in vac_todo_rows}

	out = []
	for u in users:
		uid = u.user_login_id
		if holiday_or_weekend:
			status_code = "HOLIDAY"
		else:
			att = att_by_user.get(uid)
			if att is not None and is_vacation_status(att.status):
				status_code = "VACATION"
			elif uid in vacation_todo_users:
				status_code = "VACATION"
			elif uid in report_by_user:
				status_code = "SUBMITTED"
			else:
				status_code = "MISSING"
		out.append(
			{
				"user_login_id": uid,
				"user_name": u.user_name,
				"daily_status": status_code,
			}
		)
	return out


def list_week_status(db: Session, tenant_id: int, week_start: date) -> list[dict]:
	week_start = hr_reports.monday_of(week_start)
	week_end = week_start + timedelta(days=6)

	users = (
		directory_users_in_tenant(db, tenant_id)
		.filter(User.join_date.isnot(None))
		.filter(User.join_date <= week_end)
		# 해당 주 내 재직 기간이 하루라도 있으면 포함 (주중 퇴사자 포함)
		.filter(or_(User.resignation_date.is_(None), User.resignation_date >= week_start))
		.order_by(User.user_name.asc())
		.all()
	)
	weekly_rows = {
		cast(str, w.user_id): w
		for w in weekly_reports_in_tenant(db, tenant_id)
		.filter(WeeklyReport.week_start_date == week_start)
		.all()
	}
	attendance_rows = (
		attendance_in_tenant(db, tenant_id)
		.filter(Attendance.work_date >= week_start, Attendance.work_date <= week_end)
		.all()
	)
	vac_attendance_map = {
		(cast(str, a.user_id), cast(date, a.work_date)): is_vacation_status(a.status)
		for a in attendance_rows
	}
	holiday_map = {
		cast(date, h.holiday_date): True
		for h in db.query(Holiday)
		.filter(Holiday.tenant_id == tenant_id)
		.filter(Holiday.holiday_date >= week_start, Holiday.holiday_date <= week_end)
		.all()
	}
	day_start = datetime.combine(week_start, time.min)
	day_end = datetime.combine(week_end, time.max)
	vac_todo_rows = (
		todos_in_tenant(db, tenant_id)
		.with_entities(Todo.user_id, Todo.start_date, Todo.end_date)
		.filter(Todo.category.in_(VACATION_TODO_CATEGORIES))
		.filter(Todo.start_date <= day_end)
		.filter(or_(Todo.end_date.is_(None), Todo.end_date >= day_start))
		.all()
	)
	vac_todo_map: dict[str, list[tuple[datetime, datetime | None]]] = {}
	for uid, start_dt, end_dt in vac_todo_rows:
		vac_todo_map.setdefault(uid, []).append((start_dt, end_dt))
	out = []
	for u in users:
		uid = cast(str, u.user_login_id)
		wr = weekly_rows.get(uid)
		week_days = [week_start + timedelta(days=i) for i in range(7)]
		all_holiday = True
		only_vacation_or_holiday = True
		for day in week_days:
			is_holiday = _is_weekend(day) or bool(holiday_map.get(day))
			if not is_holiday:
				all_holiday = False
			if is_holiday:
				continue
			if vac_attendance_map.get((uid, day), False):
				continue
			day_start_dt = datetime.combine(day, time.min)
			day_end_dt = datetime.combine(day, time.max)
			has_vac_todo = False
			for start_dt, end_dt in vac_todo_map.get(uid, []):
				if start_dt <= day_end_dt and (end_dt is None or end_dt >= day_start_dt):
					has_vac_todo = True
					break
			if not has_vac_todo:
				only_vacation_or_holiday = False
				break
		if all_holiday:
			weekly_status = "HOLIDAY"
		elif only_vacation_or_holiday:
			weekly_status = "VACATION"
		else:
			weekly_status = "SUBMITTED" if wr is not None else "MISSING"
		preview = ""
		if wr is not None and (wr.summary is not None) and str(wr.summary).strip():
			s = str(wr.summary).strip()
			if s:
				preview = s[:200] + ("…" if len(s) > 200 else "")
		out.append(
			{
				"user_login_id": uid,
				"user_name": u.user_name,
				"weekly_status": weekly_status,
				"weekly_submitted": wr is not None,
				"weekly_updated_at": wr.updated_at if wr else None,
				"weekly_summary_preview": preview,
			}
		)
	return out


def list_month_status(db: Session, tenant_id: int, month_start: date) -> list[dict]:
	month_start = hr_reports.first_of_month(month_start)
	month_end = hr_reports.last_of_month(month_start)

	users = (
		directory_users_in_tenant(db, tenant_id)
		.filter(User.join_date.isnot(None))
		.filter(User.join_date <= month_end)
		.filter(or_(User.resignation_date.is_(None), User.resignation_date >= month_start))
		.order_by(User.user_name.asc())
		.all()
	)
	monthly_rows = {
		cast(str, m.user_id): m
		for m in monthly_reports_in_tenant(db, tenant_id)
		.filter(MonthlyReport.month_start_date == month_start)
		.all()
	}
	attendance_rows = (
		attendance_in_tenant(db, tenant_id)
		.filter(Attendance.work_date >= month_start, Attendance.work_date <= month_end)
		.all()
	)
	vac_attendance_map = {
		(cast(str, a.user_id), cast(date, a.work_date)): is_vacation_status(a.status)
		for a in attendance_rows
	}
	holiday_map = {
		cast(date, h.holiday_date): True
		for h in db.query(Holiday)
		.filter(Holiday.tenant_id == tenant_id)
		.filter(
			Holiday.holiday_date >= month_start, Holiday.holiday_date <= month_end
		)
		.all()
	}
	day_start = datetime.combine(month_start, time.min)
	day_end = datetime.combine(month_end, time.max)
	vac_todo_rows = (
		todos_in_tenant(db, tenant_id)
		.with_entities(Todo.user_id, Todo.start_date, Todo.end_date)
		.filter(Todo.category.in_(VACATION_TODO_CATEGORIES))
		.filter(Todo.start_date <= day_end)
		.filter(or_(Todo.end_date.is_(None), Todo.end_date >= day_start))
		.all()
	)
	vac_todo_map: dict[str, list[tuple[datetime, datetime | None]]] = {}
	for uid, start_dt, end_dt in vac_todo_rows:
		vac_todo_map.setdefault(uid, []).append((start_dt, end_dt))

	month_days: list[date] = []
	d = month_start
	while d <= month_end:
		month_days.append(d)
		d += timedelta(days=1)

	out = []
	for u in users:
		uid = cast(str, u.user_login_id)
		mr = monthly_rows.get(uid)
		all_holiday = True
		only_vacation_or_holiday = True
		for day in month_days:
			is_holiday = _is_weekend(day) or bool(holiday_map.get(day))
			if not is_holiday:
				all_holiday = False
			if is_holiday:
				continue
			if vac_attendance_map.get((uid, day), False):
				continue
			day_start_dt = datetime.combine(day, time.min)
			day_end_dt = datetime.combine(day, time.max)
			has_vac_todo = False
			for start_dt, end_dt in vac_todo_map.get(uid, []):
				if start_dt <= day_end_dt and (end_dt is None or end_dt >= day_start_dt):
					has_vac_todo = True
					break
			if not has_vac_todo:
				only_vacation_or_holiday = False
				break
		if all_holiday:
			monthly_status = "HOLIDAY"
		elif only_vacation_or_holiday:
			monthly_status = "VACATION"
		else:
			monthly_status = "SUBMITTED" if mr is not None else "MISSING"
		preview = ""
		if mr is not None and (mr.summary is not None) and str(mr.summary).strip():
			s = str(mr.summary).strip()
			if s:
				preview = s[:200] + ("…" if len(s) > 200 else "")
		out.append(
			{
				"user_login_id": uid,
				"user_name": u.user_name,
				"monthly_status": monthly_status,
				"monthly_submitted": mr is not None,
				"monthly_updated_at": mr.updated_at if mr else None,
				"monthly_summary_preview": preview,
			}
		)
	return out


def get_user_bundle(db: Session, tenant_id: int, user_login_id: str, week_start: date) -> dict:
	week_start = hr_reports.monday_of(week_start)
	week_end = week_start + timedelta(days=6)

	user = require_user_by_login_id(db, tenant_id, user_login_id)

	dailies = (
		daily_reports_in_tenant(db, tenant_id)
		.filter(
			DailyReport.user_id == user_login_id,
			DailyReport.report_date >= week_start,
			DailyReport.report_date <= week_end,
		)
		.order_by(DailyReport.report_date.asc())
		.all()
	)
	weekly = (
		weekly_reports_in_tenant(db, tenant_id)
		.filter(WeeklyReport.user_id == user_login_id, WeeklyReport.week_start_date == week_start)
		.first()
	)
	month_start = hr_reports.first_of_month(week_start)
	monthly = (
		monthly_reports_in_tenant(db, tenant_id)
		.filter(
			MonthlyReport.user_id == user_login_id,
			MonthlyReport.month_start_date == month_start,
		)
		.first()
	)
	return {"dailies": dailies, "weekly": weekly, "monthly": monthly}
