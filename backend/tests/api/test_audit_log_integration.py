"""
관리자 보고 번들 열람 시 audit_logs 에 READ_REPORT_BUNDLE 기록 여부.
"""
from datetime import date, timedelta

from fastapi import status
from sqlalchemy import desc

from db.session import SessionLocal
from integration_constants import INTEGRATION_ADMIN_LOGIN_ID, INTEGRATION_EMPLOYEE_LOGIN_ID
from models.auth_models import User
from models.common_models import AuditLog


def _monday_of(d: date) -> date:
	return d - timedelta(days=d.weekday())


def test_report_bundle_creates_audit_log_row(integration_admin_client):
	ws = _monday_of(date.today()).isoformat()
	path = f"/api/admin/reports/users/{INTEGRATION_EMPLOYEE_LOGIN_ID}/bundle"
	r = integration_admin_client.get(path, params={"week_start": ws})
	assert r.status_code == status.HTTP_200_OK, r.text

	db = SessionLocal()
	try:
		admin_row = db.query(User).filter(User.user_login_id == INTEGRATION_ADMIN_LOGIN_ID).first()
		target_row = db.query(User).filter(User.user_login_id == INTEGRATION_EMPLOYEE_LOGIN_ID).first()
		assert admin_row and target_row

		log = (
			db.query(AuditLog)
			.filter(
				AuditLog.action == "READ_REPORT_BUNDLE",
				AuditLog.admin_id == admin_row.id,
				AuditLog.target_user_id == target_row.id,
			)
			.order_by(desc(AuditLog.id))
			.first()
		)
		assert log is not None
		assert path in log.endpoint or log.endpoint.endswith("/bundle")
	finally:
		db.close()
