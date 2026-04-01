from datetime import date, timedelta

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
	if user and user.resignation_date and date_from > user.resignation_date:
		return []
	query = db.query(DailyReport).filter(
		DailyReport.user_id == user_id,
		DailyReport.report_date >= date_from,
		DailyReport.report_date <= date_to,
	)
	if user and user.resignation_date:
		query = query.filter(DailyReport.report_date <= user.resignation_date)
	return query.order_by(DailyReport.report_date.asc()).all()


def upsert_daily(db: Session, user_id: str, report_date: date, content: str) -> DailyReport:
	user = db.query(User).filter(User.user_login_id == user_id).first()
	if user and user.resignation_date and report_date > user.resignation_date:
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
	if user and user.resignation_date and week_end > user.resignation_date:
		return None
	return (
		db.query(WeeklyReport)
		.filter(WeeklyReport.user_id == user_id, WeeklyReport.week_start_date == week_start)
		.first()
	)


def upsert_weekly(db: Session, user_id: str, week_start: date, summary: str) -> WeeklyReport:
	user = db.query(User).filter(User.user_login_id == user_id).first()
	week_end = week_start + timedelta(days=6)
	if user and user.resignation_date and week_end > user.resignation_date:
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
