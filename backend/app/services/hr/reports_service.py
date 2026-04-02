from datetime import date, timedelta
from typing import cast

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.auth_models import User
from models.hr_models import DailyReport, WeeklyReport


def monday_of(d: date) -> date:
	return d - timedelta(days=d.weekday())


def list_daily_range(db: Session, user_id: str, date_from: date, date_to: date) -> list[DailyReport]:
	if date_from > date_to:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="date_from은 date_to보다 늦을 수 없습니다.")
	user = db.query(User).filter(User.user_login_id == user_id).first()
	resign_d = cast(date | None, user.resignation_date) if user is not None else None
	if resign_d is not None and date_from > resign_d:
		return []
	query = db.query(DailyReport).filter(
		DailyReport.user_id == user_id,
		DailyReport.report_date >= date_from,
		DailyReport.report_date <= date_to,
	)
	if resign_d is not None:
		query = query.filter(DailyReport.report_date <= resign_d)
	return query.order_by(DailyReport.report_date.asc()).all()


def upsert_daily(db: Session, user_id: str, report_date: date, content: str) -> DailyReport:
	user = db.query(User).filter(User.user_login_id == user_id).first()
	resign_d = cast(date | None, user.resignation_date) if user is not None else None
	if resign_d is not None and report_date > resign_d:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="퇴사일 이후 날짜에는 보고서를 작성할 수 없습니다.",
		)
	text = (content or "").strip()
	if not text:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="내용을 입력해 주세요.")
	row = (
		db.query(DailyReport)
		.filter(DailyReport.user_id == user_id, DailyReport.report_date == report_date)
		.first()
	)
	if row:
		row.content = text
	else:
		row = DailyReport(user_id=user_id, report_date=report_date, content=text)
		db.add(row)
	db.commit()
	db.refresh(row)
	return row


def get_weekly(db: Session, user_id: str, week_start: date) -> WeeklyReport | None:
	user = db.query(User).filter(User.user_login_id == user_id).first()
	week_end = week_start + timedelta(days=6)
	resign_d = cast(date | None, user.resignation_date) if user is not None else None
	if resign_d is not None and week_end > resign_d:
		return None
	return (
		db.query(WeeklyReport)
		.filter(WeeklyReport.user_id == user_id, WeeklyReport.week_start_date == week_start)
		.first()
	)


def upsert_weekly(db: Session, user_id: str, week_start: date, summary: str) -> WeeklyReport:
	user = db.query(User).filter(User.user_login_id == user_id).first()
	week_end = week_start + timedelta(days=6)
	resign_d = cast(date | None, user.resignation_date) if user is not None else None
	if resign_d is not None and week_end > resign_d:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="퇴사일 이후 주차에는 주간 보고를 작성할 수 없습니다.",
		)
	text = (summary or "").strip()
	if not text:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="주간 요약을 입력해 주세요.")
	row = (
		db.query(WeeklyReport)
		.filter(WeeklyReport.user_id == user_id, WeeklyReport.week_start_date == week_start)
		.first()
	)
	if row:
		row.summary = text
	else:
		row = WeeklyReport(user_id=user_id, week_start_date=week_start, summary=text)
		db.add(row)
	db.commit()
	db.refresh(row)
	return row
