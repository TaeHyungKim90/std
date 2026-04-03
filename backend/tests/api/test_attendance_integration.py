"""출퇴근·clock-context API 통합 테스트 (통합 SQLite, try/finally 로 To-Do·근태 정리)."""

from datetime import date, datetime, time, timedelta

import pytest
from fastapi import status

from db.session import SessionLocal
from integration_constants import INTEGRATION_EMPLOYEE_LOGIN_ID
from models.hr_models import Attendance, Todo


def _cleanup_employee_day(user_login_id: str, work_date: date, todo_id: int | None) -> None:
	db = SessionLocal()
	try:
		db.query(Attendance).filter(
			Attendance.user_id == user_login_id,
			Attendance.work_date == work_date,
		).delete()
		if todo_id is not None:
			db.query(Todo).filter(Todo.id == todo_id).delete()
		db.commit()
	finally:
		db.close()


@pytest.fixture
def vacation_full_todo_today():
	"""당일 종일 연차 To-Do를 DB에 직접 넣고 테스트 후 삭제(HR To-Do API는 연차 정산 전제)."""
	today = date.today()
	db = SessionLocal()
	try:
		t = Todo(
			user_id=INTEGRATION_EMPLOYEE_LOGIN_ID,
			title="pytest 종일연차",
			start_date=datetime.combine(today, time.min),
			end_date=datetime.combine(today, time.max),
			category="vacation_full",
		)
		db.add(t)
		db.commit()
		db.refresh(t)
		todo_id = t.id
	finally:
		db.close()
	yield todo_id
	_cleanup_employee_day(INTEGRATION_EMPLOYEE_LOGIN_ID, today, todo_id)


def test_hr_clock_context_requires_full_day_when_vacation_full_todo(
	integration_employee_client, vacation_full_todo_today
):
	r = integration_employee_client.get("/api/hr/attendance/clock-context")
	assert r.status_code == status.HTTP_200_OK, r.text
	body = r.json()
	assert body.get("requires_full_day_vacation_confirm") is True


def test_hr_clock_in_409_without_confirm_when_vacation_full(
	integration_employee_client, vacation_full_todo_today
):
	r = integration_employee_client.post(
		"/api/hr/attendance/clock-in",
		json={
			"location_name": "본사",
			"latitude": 37.5665,
			"longitude": 126.9780,
			"note": "",
		},
	)
	assert r.status_code == status.HTTP_409_CONFLICT, r.text
	detail = r.json().get("detail")
	assert isinstance(detail, dict)
	assert detail.get("code") == "VACATION_CONFIRM_REQUIRED"


def test_hr_clock_in_ok_with_confirm_when_vacation_full(integration_employee_client, vacation_full_todo_today):
	today = date.today()
	try:
		r = integration_employee_client.post(
			"/api/hr/attendance/clock-in",
			json={
				"location_name": "본사",
				"latitude": 37.5665,
				"longitude": 126.9780,
				"note": "",
				"confirm_full_day_vacation": True,
			},
		)
		assert r.status_code == status.HTTP_200_OK, r.text
		assert r.json().get("clock_in_time") is not None
	finally:
		_cleanup_employee_day(INTEGRATION_EMPLOYEE_LOGIN_ID, today, None)


def test_admin_user_attendance_range_includes_meta_keys(integration_admin_client):
	start = (date.today() - timedelta(days=7)).isoformat()
	end = date.today().isoformat()
	r = integration_admin_client.get(
		f"/api/admin/attendance/user/{INTEGRATION_EMPLOYEE_LOGIN_ID}/range",
		params={"start_date": start, "end_date": end},
	)
	assert r.status_code == status.HTTP_200_OK, r.text
	items = r.json().get("items") or []
	if not items:
		pytest.skip("기간 내 근태 행이 없어 메타 키 검증 생략")
	row = items[0]
	for key in (
		"vacation_todo_summary",
		"half_day_type",
		"review_hint",
		"is_weekend",
		"is_public_holiday",
		"holiday_name",
	):
		assert key in row, f"missing key {key}"
