"""
인증·권한 스모크: 보호된 경로가 비인증 시 401, 일반 사용자의 관리자 API는 403.
DB·비즈니스 로직 없이 라우터·의존성 체인만 검증합니다.
"""
from datetime import date, timedelta

from fastapi import status
from fastapi.testclient import TestClient

import main as app_main
from services.auth_service import get_current_user


def _client():
	return TestClient(app_main.app)


def test_auth_check_unauthenticated_is_not_logged_in():
	res = _client().get("/api/auth/check")
	assert res.status_code == status.HTTP_200_OK
	body = res.json()
	assert body.get("isLoggedIn") is False


def test_auth_me_requires_authentication():
	res = _client().get("/api/auth/me")
	assert res.status_code == status.HTTP_401_UNAUTHORIZED


def test_hr_attendance_today_requires_authentication():
	res = _client().get("/api/hr/attendance/today")
	assert res.status_code == status.HTTP_401_UNAUTHORIZED


def test_hr_reports_daily_requires_authentication():
	d0 = date.today()
	d1 = d0 - timedelta(days=6)
	res = _client().get(
		"/api/hr/reports/daily",
		params={"date_from": d1.isoformat(), "date_to": d0.isoformat()},
	)
	assert res.status_code == status.HTTP_401_UNAUTHORIZED


def test_admin_reports_daily_status_requires_authentication():
	wd = date.today().isoformat()
	res = _client().get("/api/admin/reports/daily-status", params={"work_date": wd})
	assert res.status_code == status.HTTP_401_UNAUTHORIZED


def test_admin_attendance_all_requires_authentication():
	res = _client().get("/api/admin/attendance/all")
	assert res.status_code == status.HTTP_401_UNAUTHORIZED


def test_admin_attendance_patch_record_requires_authentication():
	res = _client().patch("/api/admin/attendance/records/1", json={})
	assert res.status_code == status.HTTP_401_UNAUTHORIZED


def test_admin_reports_forbidden_for_non_admin_role():
	app_main.app.dependency_overrides[get_current_user] = lambda: {
		"id": 1,
		"userId": "user1",
		"role": "user",
	}
	try:
		wd = date.today().isoformat()
		res = _client().get("/api/admin/reports/daily-status", params={"work_date": wd})
		assert res.status_code == status.HTTP_403_FORBIDDEN
	finally:
		app_main.app.dependency_overrides.clear()


def test_public_recruitment_apply_me_requires_applicant_session():
	res = _client().post(
		"/api/public/recruitment/apply/me",
		json={"job_id": 1, "resume_file_url": "https://example.com/r.pdf"},
	)
	assert res.status_code == status.HTTP_401_UNAUTHORIZED


def test_public_recruitment_me_requires_applicant_session():
	res = _client().get("/api/public/recruitment/me")
	assert res.status_code == status.HTTP_401_UNAUTHORIZED
