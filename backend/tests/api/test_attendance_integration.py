"""출퇴근·clock-context API 통합 테스트 (통합 SQLite, try/finally 로 To-Do·근태 정리)."""

from datetime import date, datetime, time, timedelta

import pytest
from fastapi import status

from constants.attendance_shift import SHIFT_STATUS_IN_PROGRESS
from db.session import SessionLocal
from integration_constants import INTEGRATION_EMPLOYEE_LOGIN_ID
from models.hr_models import Attendance, Todo
from utils.seoul_time import today_seoul


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
	today = today_seoul()
	db = SessionLocal()
	try:
		t = Todo(
			tenant_id=1,
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
	assert "preferred_work_location" in body


def test_hr_patch_preferred_work_location_invalid(integration_employee_client):
	r = integration_employee_client.patch(
		"/api/hr/attendance/preferred-work-location",
		json={"location_name": "__no_such_active_location__"},
	)
	assert r.status_code == status.HTTP_400_BAD_REQUEST, r.text


def test_hr_patch_preferred_work_location_then_clock_context(integration_employee_client):
	r = integration_employee_client.patch(
		"/api/hr/attendance/preferred-work-location",
		json={"location_name": "회사"},
	)
	assert r.status_code == status.HTTP_200_OK, r.text
	assert r.json().get("preferred_work_location") == "company"
	r2 = integration_employee_client.get("/api/hr/attendance/clock-context")
	assert r2.status_code == status.HTTP_200_OK, r2.text
	assert r2.json().get("preferred_work_location") == "company"


def test_hr_clock_in_409_without_confirm_when_vacation_full(
	integration_employee_client, vacation_full_todo_today
):
	r = integration_employee_client.post(
		"/api/hr/attendance/clock-in",
		json={
			"location_name": "회사",
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
	today = today_seoul()
	try:
		r = integration_employee_client.post(
			"/api/hr/attendance/clock-in",
			json={
				"location_name": "회사",
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
	start = (today_seoul() - timedelta(days=7)).isoformat()
	end = today_seoul().isoformat()
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


def _delete_user_attendances_on_date(user_login_id: str, work_date: date) -> None:
	db = SessionLocal()
	try:
		db.query(Attendance).filter(
			Attendance.user_id == user_login_id,
			Attendance.work_date == work_date,
		).delete()
		db.commit()
	finally:
		db.close()


def test_hr_clock_out_uses_open_shift_not_calendar_today(integration_employee_client):
	"""전일 출근만 있고 퇴근이 없을 때(야근) 달력이 바뀌어도 퇴근 API가 동작해야 한다."""
	yesterday = today_seoul() - timedelta(days=1)
	_delete_user_attendances_on_date(INTEGRATION_EMPLOYEE_LOGIN_ID, yesterday)
	try:
		db = SessionLocal()
		try:
			a = Attendance(
				tenant_id=1,
				user_id=INTEGRATION_EMPLOYEE_LOGIN_ID,
				work_date=yesterday,
				clock_in_time=datetime.combine(yesterday, time(20, 0)),
				clock_out_time=None,
				status="NORMAL",
				work_minutes=0,
				shift_status=SHIFT_STATUS_IN_PROGRESS,
			)
			db.add(a)
			db.commit()
		finally:
			db.close()

		r = integration_employee_client.post(
			"/api/hr/attendance/clock-out",
			json={
				"location_name": "회사",
				"latitude": 37.5665,
				"longitude": 126.9780,
				"note": "",
			},
		)
		assert r.status_code == status.HTTP_200_OK, r.text
		data = r.json()
		assert data.get("clock_out_time") is not None
		assert data.get("shift_status") == "CLOSED"
		assert data.get("work_date") == str(yesterday)
	finally:
		_delete_user_attendances_on_date(INTEGRATION_EMPLOYEE_LOGIN_ID, yesterday)


def test_hr_clock_in_rejected_when_open_shift_exists(integration_employee_client):
	"""전일 미종료 근무가 있으면 당일 출근을 막는다."""
	yesterday = today_seoul() - timedelta(days=1)
	_delete_user_attendances_on_date(INTEGRATION_EMPLOYEE_LOGIN_ID, yesterday)
	try:
		db = SessionLocal()
		try:
			a = Attendance(
				tenant_id=1,
				user_id=INTEGRATION_EMPLOYEE_LOGIN_ID,
				work_date=yesterday,
				clock_in_time=datetime.combine(yesterday, time(9, 0)),
				clock_out_time=None,
				status="NORMAL",
				work_minutes=0,
				shift_status=SHIFT_STATUS_IN_PROGRESS,
			)
			db.add(a)
			db.commit()
		finally:
			db.close()

		r = integration_employee_client.post(
			"/api/hr/attendance/clock-in",
			json={
				"location_name": "회사",
				"latitude": 37.5665,
				"longitude": 126.9780,
				"note": "",
			},
		)
		assert r.status_code == status.HTTP_400_BAD_REQUEST, r.text
		assert "미종료" in (r.json().get("detail") or "")
	finally:
		_delete_user_attendances_on_date(INTEGRATION_EMPLOYEE_LOGIN_ID, yesterday)


def test_hr_clock_out_response_includes_night_work_minutes(integration_employee_client):
	today = today_seoul()
	_delete_user_attendances_on_date(INTEGRATION_EMPLOYEE_LOGIN_ID, today)
	try:
		db = SessionLocal()
		try:
			a = Attendance(
				tenant_id=1,
				user_id=INTEGRATION_EMPLOYEE_LOGIN_ID,
				work_date=today,
				clock_in_time=datetime.combine(today, time(9, 0)),
				clock_out_time=None,
				status="NORMAL",
				work_minutes=0,
				night_work_minutes=0,
				shift_status=SHIFT_STATUS_IN_PROGRESS,
			)
			db.add(a)
			db.commit()
		finally:
			db.close()

		r = integration_employee_client.post(
			"/api/hr/attendance/clock-out",
			json={
				"location_name": "회사",
				"latitude": 37.5665,
				"longitude": 126.9780,
				"note": "",
			},
		)
		assert r.status_code == status.HTTP_200_OK, r.text
		data = r.json()
		assert "night_work_minutes" in data
		assert isinstance(data["night_work_minutes"], int)
	finally:
		_delete_user_attendances_on_date(INTEGRATION_EMPLOYEE_LOGIN_ID, today)


def test_hr_two_sessions_same_day(integration_employee_client):
	today = today_seoul()
	_delete_user_attendances_on_date(INTEGRATION_EMPLOYEE_LOGIN_ID, today)
	try:
		body = {
			"location_name": "회사",
			"latitude": 37.5665,
			"longitude": 126.9780,
			"note": "",
		}
		r_in = integration_employee_client.post("/api/hr/attendance/clock-in", json=body)
		assert r_in.status_code == status.HTTP_200_OK, r_in.text
		r_out = integration_employee_client.post("/api/hr/attendance/clock-out", json=body)
		assert r_out.status_code == status.HTTP_200_OK, r_out.text
		r_in2 = integration_employee_client.post("/api/hr/attendance/clock-in", json=body)
		assert r_in2.status_code == status.HTTP_200_OK, r_in2.text

		r_sess = integration_employee_client.get(
			"/api/hr/attendance/day/sessions",
			params={"work_date": today.isoformat()},
		)
		assert r_sess.status_code == status.HTTP_200_OK, r_sess.text
		items = r_sess.json().get("items") or []
		assert len(items) == 2
		assert items[0].get("shift_status") == "CLOSED"
		assert items[1].get("shift_status") == "IN_PROGRESS"
	finally:
		_delete_user_attendances_on_date(INTEGRATION_EMPLOYEE_LOGIN_ID, today)
