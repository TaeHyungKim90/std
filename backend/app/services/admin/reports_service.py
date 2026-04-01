from datetime import date, datetime, time, timedelta

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from constants.vacation_categories import VACATION_TODO_CATEGORIES
from models.auth_models import User
from models.holiday_models import Holiday
from models.hr_models import Attendance, DailyReport, Todo, WeeklyReport
from services.hr import reports_service as hr_reports
from services.hr.attendance_service import is_vacation_status


def _is_weekend(d: date) -> bool:
	return d.weekday() >= 5


def _is_public_holiday(db: Session, work_date: date) -> bool:
	return db.query(Holiday.id).filter(Holiday.holiday_date == work_date).first() is not None


def list_daily_status(db: Session, work_date: date) -> list[dict]:
	"""일일보고 현황: 휴일 → 휴가(근태/일정) → 작성완료/미작성 순으로 판별."""
	users = (
		db.query(User)
		.filter(User.join_date.isnot(None))
		.filter(User.join_date <= work_date)
		# 기준일(work_date) 이전에 퇴사한 직원은 제외 (퇴사일이 기준일 이상이면 포함)
		.filter(or_(User.resignation_date.is_(None), User.resignation_date >= work_date))
		.order_by(User.user_name.asc())
		.all()
	)

	holiday_or_weekend = _is_weekend(work_date) or _is_public_holiday(db, work_date)

	att_by_user = {
		a.user_id: a
		for a in db.query(Attendance).filter(Attendance.work_date == work_date).all()
	}
	report_by_user = {
		r.user_id: r
		for r in db.query(DailyReport).filter(DailyReport.report_date == work_date).all()
	}

	day_start = datetime.combine(work_date, time.min)
	day_end = datetime.combine(work_date, time.max)
	vac_todo_rows = (
		db.query(Todo.user_id)
		.filter(Todo.category.in_(VACATION_TODO_CATEGORIES))
		.filter(Todo.start_date <= day_end)
		.filter(or_(Todo.end_date.is_(None), Todo.end_date >= day_start))
		.distinct()
		.all()
	)
	vacation_todo_users = {row[0] for row in vac_todo_rows}

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


def list_week_status(db: Session, week_start: date) -> list[dict]:
	week_start = hr_reports.monday_of(week_start)
	week_end = week_start + timedelta(days=6)

	users = (
		db.query(User)
		.filter(User.join_date.isnot(None))
		.filter(User.join_date <= week_end)
		# 해당 주 내 재직 기간이 하루라도 있으면 포함 (주중 퇴사자 포함)
		.filter(or_(User.resignation_date.is_(None), User.resignation_date >= week_start))
		.order_by(User.user_name.asc())
		.all()
	)
	weekly_rows = {
		w.user_id: w
		for w in db.query(WeeklyReport).filter(WeeklyReport.week_start_date == week_start).all()
	}
	attendance_rows = (
		db.query(Attendance)
		.filter(Attendance.work_date >= week_start, Attendance.work_date <= week_end)
		.all()
	)
	vac_attendance_map = {
		(a.user_id, a.work_date): is_vacation_status(a.status)
		for a in attendance_rows
	}
	holiday_map = {
		h.holiday_date: True
		for h in db.query(Holiday).filter(Holiday.holiday_date >= week_start, Holiday.holiday_date <= week_end).all()
	}
	day_start = datetime.combine(week_start, time.min)
	day_end = datetime.combine(week_end, time.max)
	vac_todo_rows = (
		db.query(Todo.user_id, Todo.start_date, Todo.end_date)
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
		wr = weekly_rows.get(u.user_login_id)
		week_days = [week_start + timedelta(days=i) for i in range(7)]
		all_holiday = True
		only_vacation_or_holiday = True
		for day in week_days:
			is_holiday = _is_weekend(day) or bool(holiday_map.get(day))
			if not is_holiday:
				all_holiday = False
			if is_holiday:
				continue
			if vac_attendance_map.get((u.user_login_id, day), False):
				continue
			day_start_dt = datetime.combine(day, time.min)
			day_end_dt = datetime.combine(day, time.max)
			has_vac_todo = False
			for start_dt, end_dt in vac_todo_map.get(u.user_login_id, []):
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
		if wr is not None and wr.summary:
			s = (wr.summary or "").strip()
			if s:
				preview = s[:200] + ("…" if len(s) > 200 else "")
		out.append(
			{
				"user_login_id": u.user_login_id,
				"user_name": u.user_name,
				"weekly_status": weekly_status,
				"weekly_submitted": wr is not None,
				"weekly_updated_at": wr.updated_at if wr else None,
				"weekly_summary_preview": preview,
			}
		)
	return out


def get_user_bundle(db: Session, user_login_id: str, week_start: date) -> dict:
	week_start = hr_reports.monday_of(week_start)
	week_end = week_start + timedelta(days=6)

	user = db.query(User).filter(User.user_login_id == user_login_id).first()
	if not user:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다.")

	dailies = (
		db.query(DailyReport)
		.filter(
			DailyReport.user_id == user_login_id,
			DailyReport.report_date >= week_start,
			DailyReport.report_date <= week_end,
		)
		.order_by(DailyReport.report_date.asc())
		.all()
	)
	weekly = (
		db.query(WeeklyReport)
		.filter(WeeklyReport.user_id == user_login_id, WeeklyReport.week_start_date == week_start)
		.first()
	)
	return {"dailies": dailies, "weekly": weekly}
