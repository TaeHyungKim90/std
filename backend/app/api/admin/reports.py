from datetime import date
import logging
from typing import cast

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from db.session import get_db
from api.deps import tenant_id_from_user
from models.auth_models import User
from schemas.hr import reports_schemas
from services.admin import audit_service
from services.admin import reports_service as admin_reports
from services.auth_service import get_current_admin_for_tenant
from utils.date_validators import validate_report_date_range

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/daily-status", response_model=list[reports_schemas.AdminDailyStatusRow])
def report_daily_status(
	work_date: date = Query(..., alias="work_date"),
	db: Session = Depends(get_db),
	_: dict = Depends(get_current_admin_for_tenant),
):
	try:
		validate_report_date_range(work_date, "work_date")
	except ValueError as e:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
	tid = tenant_id_from_user(_)
	return admin_reports.list_daily_status(db, tid, work_date)


@router.get("/status", response_model=list[reports_schemas.AdminWeekReportStatusRow])
def report_week_status(
	week_start: date = Query(..., alias="week_start"),
	db: Session = Depends(get_db),
	_: dict = Depends(get_current_admin_for_tenant),
):
	try:
		validate_report_date_range(week_start, "week_start")
	except ValueError as e:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
	tid = tenant_id_from_user(_)
	return admin_reports.list_week_status(db, tid, week_start)


@router.get("/monthly-status", response_model=list[reports_schemas.AdminMonthReportStatusRow])
def report_month_status(
	month_start: date = Query(..., alias="month_start"),
	db: Session = Depends(get_db),
	_: dict = Depends(get_current_admin_for_tenant),
):
	try:
		validate_report_date_range(month_start, "month_start")
	except ValueError as e:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
	tid = tenant_id_from_user(_)
	return admin_reports.list_month_status(db, tid, month_start)


@router.get("/users/{user_login_id}/bundle", response_model=reports_schemas.AdminReportBundleOut)
def user_report_bundle(
	request: Request,
	user_login_id: str,
	week_start: date = Query(..., alias="week_start"),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	try:
		validate_report_date_range(week_start, "week_start")
	except ValueError as e:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
	data = admin_reports.get_user_bundle(db, tenant_id_from_user(current_admin), user_login_id, week_start)

	# 감사 로그: 다른 관리자가 누구의 보고서를 열람했는지 기록 (실패해도 메인 로직 영향 없음)
	try:
		admin_login_id = current_admin.get("userId")
		admin_user = db.query(User).filter(User.user_login_id == admin_login_id).first()
		target_user = db.query(User).filter(User.user_login_id == user_login_id).first()
		if admin_user and target_user:
			xff = request.headers.get("x-forwarded-for") or ""
			ip = xff.split(",")[0].strip() if xff else (request.client.host if request.client else None)
			audit_service.create_audit_log(
				db,
				admin_id=int(cast(int, admin_user.id)),
				target_user_id=int(cast(int, target_user.id)),
				action="READ_REPORT_BUNDLE",
				endpoint=str(request.url.path),
				ip_address=ip,
			)
	except Exception:
		# 감사 로그 실패 무시
		logger.exception("[audit] failed to enqueue/write audit log")

	return reports_schemas.AdminReportBundleOut(
		dailies=data["dailies"],
		weekly=data["weekly"],
		monthly=data.get("monthly"),
	)
