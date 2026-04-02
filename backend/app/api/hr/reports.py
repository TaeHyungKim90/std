from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.hr import reports_schemas
from services.auth_service import get_current_user, require_user_login_id
from services.hr import reports_service as service
from utils.date_validators import validate_report_date_range

router = APIRouter()

@router.get("/daily", response_model=list[reports_schemas.DailyReportOut])
def read_daily_range(
	date_from: date = Query(..., alias="date_from"),
	date_to: date = Query(..., alias="date_to"),
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user),
):
	try:
		validate_report_date_range(date_from, "date_from")
		validate_report_date_range(date_to, "date_to")
	except ValueError as e:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
	user_id = require_user_login_id(current_user)
	return service.list_daily_range(db, user_id, date_from, date_to)


@router.put("/daily", response_model=reports_schemas.DailyReportOut)
def upsert_daily(
	payload: reports_schemas.DailyReportUpsert,
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user),
):
	user_id = require_user_login_id(current_user)
	return service.upsert_daily(db, user_id, payload.report_date, payload.content)


@router.get("/weekly", response_model=Optional[reports_schemas.WeeklyReportOut])
def read_weekly(
	week_start: date = Query(..., alias="week_start"),
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user),
):
	try:
		validate_report_date_range(week_start, "week_start")
	except ValueError as e:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
	user_id = require_user_login_id(current_user)
	ws = service.monday_of(week_start)
	return service.get_weekly(db, user_id, ws)


@router.put("/weekly", response_model=reports_schemas.WeeklyReportOut)
def upsert_weekly(
	payload: reports_schemas.WeeklyReportUpsert,
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user),
):
	try:
		validate_report_date_range(payload.week_start_date, "week_start_date")
	except ValueError as e:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
	user_id = require_user_login_id(current_user)
	ws = service.monday_of(payload.week_start_date)
	return service.upsert_weekly(db, user_id, ws, payload.summary)
