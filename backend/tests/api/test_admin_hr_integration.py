"""
관리자·HR API 해피 패스 통합 테스트 (실제 로그인 쿠키 + 테스트 전용 SQLite).
픽스처는 conftest.py 의 integration_* 를 사용합니다.
"""
from datetime import date, timedelta

import pytest
from fastapi import status

from integration_constants import (
	INTEGRATION_ADMIN_LOGIN_ID,
	INTEGRATION_EMPLOYEE_LOGIN_ID,
)


def _monday_of(d: date) -> date:
	return d - timedelta(days=d.weekday())


def test_admin_daily_status_ok(integration_admin_client):
	wd = date.today().isoformat()
	r = integration_admin_client.get("/api/admin/reports/daily-status", params={"work_date": wd})
	assert r.status_code == status.HTTP_200_OK, r.text
	body = r.json()
	assert isinstance(body, list)
	ids = {row["user_login_id"] for row in body}
	assert INTEGRATION_ADMIN_LOGIN_ID in ids
	assert INTEGRATION_EMPLOYEE_LOGIN_ID in ids


def test_admin_week_status_ok(integration_admin_client):
	ws = _monday_of(date.today()).isoformat()
	r = integration_admin_client.get("/api/admin/reports/status", params={"week_start": ws})
	assert r.status_code == status.HTTP_200_OK, r.text
	assert isinstance(r.json(), list)


def test_admin_attendance_all_ok(integration_admin_client):
	r = integration_admin_client.get("/api/admin/attendance/all", params={"limit": 50})
	assert r.status_code == status.HTTP_200_OK, r.text
	data = r.json()
	assert "items" in data and "total" in data
	assert isinstance(data["items"], list)


def test_employee_hr_attendance_today_ok(integration_employee_client):
	r = integration_employee_client.get("/api/hr/attendance/today")
	assert r.status_code == status.HTTP_200_OK, r.text


def test_employee_daily_report_upsert_and_list(integration_employee_client):
	d0 = date.today()
	d1 = d0 - timedelta(days=3)
	r_put = integration_employee_client.put(
		"/api/hr/reports/daily",
		json={"report_date": d0.isoformat(), "content": "pytest 일일 보고 본문"},
	)
	assert r_put.status_code == status.HTTP_200_OK, r_put.text
	row = r_put.json()
	assert row.get("user_id") == INTEGRATION_EMPLOYEE_LOGIN_ID
	assert row.get("content") == "pytest 일일 보고 본문"

	r_get = integration_employee_client.get(
		"/api/hr/reports/daily",
		params={"date_from": d1.isoformat(), "date_to": d0.isoformat()},
	)
	assert r_get.status_code == status.HTTP_200_OK, r_get.text
	rows = r_get.json()
	assert any(x.get("report_date") == d0.isoformat() for x in rows)


def test_admin_sees_submitted_daily_after_employee_writes(
	integration_admin_client, integration_employee_client
):
	"""평일이면 직원 일보 작성 후 관리자 일일 현황에 SUBMITTED 로 반영되는지 검증."""
	today = date.today()
	if today.weekday() >= 5:
		pytest.skip("주말에는 일일 현황이 HOLIDAY 로만 나와 SUBMITTED 검증 생략")

	r_put = integration_employee_client.put(
		"/api/hr/reports/daily",
		json={"report_date": today.isoformat(), "content": "관리자 현황 연동 확인용"},
	)
	assert r_put.status_code == status.HTTP_200_OK, r_put.text

	r = integration_admin_client.get(
		"/api/admin/reports/daily-status",
		params={"work_date": today.isoformat()},
	)
	assert r.status_code == status.HTTP_200_OK, r.text
	for row in r.json():
		if row["user_login_id"] == INTEGRATION_EMPLOYEE_LOGIN_ID:
			assert row["daily_status"] == "SUBMITTED"
			break
	else:
		pytest.fail("pytest_integration_user 가 일일 현황에 없습니다")


def test_employee_weekly_report_upsert(integration_employee_client):
	ws = _monday_of(date.today())
	r_put = integration_employee_client.put(
		"/api/hr/reports/weekly",
		json={"week_start_date": ws.isoformat(), "summary": "pytest 주간 요약"},
	)
	assert r_put.status_code == status.HTTP_200_OK, r_put.text
	assert r_put.json().get("summary") == "pytest 주간 요약"

	r_get = integration_employee_client.get(
		"/api/hr/reports/weekly",
		params={"week_start": ws.isoformat()},
	)
	assert r_get.status_code == status.HTTP_200_OK, r_get.text
	assert r_get.json() is not None
	assert r_get.json().get("summary") == "pytest 주간 요약"
