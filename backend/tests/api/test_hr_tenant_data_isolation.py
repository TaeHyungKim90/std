"""동일 user_login_id가 두 테넌트에 있을 때 HR 활동 데이터가 섞이지 않는지 검증."""

from datetime import date, datetime, time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import joinedload

import main as app_main
from core.security import create_access_token
from db.session import get_db

from models.auth_models import User, UserVacation
from models.hr_models import Attendance, DailyReport, Todo, WeeklyReport
from models.tenant_models import Tenant
from services.admin import attendance_service as admin_attendance
from services.admin import reports_service as admin_reports
from services.admin.user_service import calculate_user_vacation_snapshot, sync_user_vacation
from services.hr import reports_service as hr_reports
from services.hr import todos_service
from schemas.hr.todos_schemas import TodoCreate
from support.memory_db import memory_db_session
from utils.seoul_time import today_seoul


@pytest.fixture()
def db_session():
	with memory_db_session() as session:
		yield session


@pytest.fixture()
def two_tenants_with_shared_admin(db_session):
	t2 = Tenant(slug="naver", name="Naver Test", is_active=True)
	db_session.add(t2)
	db_session.commit()
	db_session.refresh(t2)
	tid_b = int(t2.id)
	tid_a = 1

	for tid in (tid_a, tid_b):
		db_session.add(
			User(
				tenant_id=tid,
				user_login_id="admin",
				user_password="x",
				user_name=f"Admin {tid}",
				join_date=date(2020, 1, 1),
			)
		)
	db_session.commit()
	return tid_a, tid_b


def test_daily_report_isolated_by_tenant(db_session, two_tenants_with_shared_admin):
	tid_a, tid_b = two_tenants_with_shared_admin
	work_date = date(2026, 5, 11)  # 월요일(근무일)

	hr_reports.upsert_daily(db_session, tid_a, "admin", work_date, "테넌트 A 보고")

	rows_a = hr_reports.list_daily_range(
		db_session, tid_a, "admin", work_date, work_date
	)
	rows_b = hr_reports.list_daily_range(
		db_session, tid_b, "admin", work_date, work_date
	)
	assert len(rows_a) == 1
	assert rows_a[0].content == "테넌트 A 보고"
	assert rows_b == []

	status_a = admin_reports.list_daily_status(db_session, tid_a, work_date)
	status_b = admin_reports.list_daily_status(db_session, tid_b, work_date)
	by_login_a = {r["user_login_id"]: r["daily_status"] for r in status_a}
	by_login_b = {r["user_login_id"]: r["daily_status"] for r in status_b}
	assert by_login_a.get("admin") == "SUBMITTED"
	assert by_login_b.get("admin") == "MISSING"


def test_weekly_report_isolated_by_tenant(db_session, two_tenants_with_shared_admin):
	tid_a, tid_b = two_tenants_with_shared_admin
	week_start = date(2026, 5, 5)

	hr_reports.upsert_weekly(db_session, tid_a, "admin", week_start, "A 주간")

	assert hr_reports.get_weekly(db_session, tid_a, "admin", week_start) is not None
	assert hr_reports.get_weekly(db_session, tid_b, "admin", week_start) is None


def test_check_auth_rejects_cross_tenant_session(db_session, two_tenants_with_shared_admin):
	"""A 테넌트 JWT로 B 테넌트 /auth/check 요청 시 비로그인으로 처리."""
	tid_a, tid_b = two_tenants_with_shared_admin
	user_a = db_session.query(User).filter(User.tenant_id == tid_a, User.user_login_id == "admin").one()
	token = create_access_token(
		{
			"userId": user_a.user_login_id,
			"userName": user_a.user_name,
			"userNickname": user_a.user_nickname,
			"role": user_a.role,
			"id": user_a.id,
			"tenantId": tid_a,
			"tenantSlug": "valuesplay",
		}
	)

	def _override_db():
		yield db_session

	app_main.app.dependency_overrides[get_db] = _override_db
	try:
		client = TestClient(app_main.app)
		client.cookies.set("accessToken", token)
		res_a = client.get(
			"/api/auth/check",
			headers={"X-Tenant-Slug": "valuesplay"},
		)
		res_b = client.get(
			"/api/auth/check",
			headers={"X-Tenant-Slug": "naver"},
		)
		assert res_a.status_code == 200
		assert res_a.json().get("isLoggedIn") is True
		assert res_b.status_code == 200
		assert res_b.json().get("isLoggedIn") is False
	finally:
		app_main.app.dependency_overrides.clear()


def test_admin_daily_attendance_one_row_per_user_per_tenant(db_session, two_tenants_with_shared_admin):
	"""동일 user_login_id가 두 테넌트에 있어도 관리자 일일 근태는 직원당 1행만 반환."""
	tid_a, tid_b = two_tenants_with_shared_admin
	work_date = date(2026, 6, 8)
	clock_in = datetime(2026, 6, 8, 9, 0, 0)

	db_session.add(
		Attendance(
			tenant_id=tid_a,
			user_id="admin",
			work_date=work_date,
			clock_in_time=clock_in,
		)
	)
	db_session.add(
		Attendance(
			tenant_id=tid_b,
			user_id="admin",
			work_date=work_date,
			clock_in_time=clock_in,
		)
	)
	# 같은 테넌트·같은 날 복수 세션도 1행으로 대표
	db_session.add(
		Attendance(
			tenant_id=tid_a,
			user_id="admin",
			work_date=work_date,
			clock_in_time=datetime(2026, 6, 8, 18, 0, 0),
		)
	)
	db_session.commit()

	res_a = admin_attendance.get_all_attendance(
		db_session, tid_a, work_date=work_date.isoformat(), limit=20
	)
	res_b = admin_attendance.get_all_attendance(
		db_session, tid_b, work_date=work_date.isoformat(), limit=20
	)

	assert res_a["total"] == 1
	assert len(res_a["items"]) == 1
	assert res_a["items"][0]["user_id"] == "admin"
	assert res_a["items"][0]["clock_in_time"] is not None

	assert res_b["total"] == 1
	assert len(res_b["items"]) == 1
	assert res_b["items"][0]["user_id"] == "admin"


def test_user_vacation_relationship_isolated_by_tenant(db_session, two_tenants_with_shared_admin):
	"""joinedload(User.vacation)이 타 테넌트 연차를 끌어오지 않는지 검증."""
	tid_a, tid_b = two_tenants_with_shared_admin
	today = date(2026, 6, 8)

	user_a = db_session.query(User).filter(User.tenant_id == tid_a, User.user_login_id == "admin").one()
	user_b = db_session.query(User).filter(User.tenant_id == tid_b, User.user_login_id == "admin").one()
	user_a.join_date = date(2026, 1, 2)
	user_b.join_date = date(2020, 1, 1)
	db_session.commit()

	sync_user_vacation(db_session, user_a, today)
	sync_user_vacation(db_session, user_b, today)
	db_session.commit()

	loaded_a = (
		db_session.query(User)
		.options(joinedload(User.vacation))
		.filter(User.id == user_a.id)
		.one()
	)
	loaded_b = (
		db_session.query(User)
		.options(joinedload(User.vacation))
		.filter(User.id == user_b.id)
		.one()
	)

	assert loaded_a.vacation is not None
	assert loaded_b.vacation is not None
	assert loaded_a.vacation.total_days == 5
	assert loaded_b.vacation.total_days == 17
	assert loaded_a.vacation.tenant_id == tid_a
	assert loaded_b.vacation.tenant_id == tid_b


def test_vacation_todo_balance_isolated_by_tenant(db_session, two_tenants_with_shared_admin):
	tid_a, tid_b = two_tenants_with_shared_admin
	d = date(2026, 7, 1)
	st = datetime.combine(d, time.min)
	en = datetime.combine(d, time.max)

	todos_service.create_todo(
		db_session,
		tid_a,
		TodoCreate(
			title="연차",
			start_date=st,
			end_date=en,
			category="vacation_full",
		),
		"admin",
	)

	user_a = db_session.query(User).filter(User.tenant_id == tid_a, User.user_login_id == "admin").one()
	user_b = db_session.query(User).filter(User.tenant_id == tid_b, User.user_login_id == "admin").one()

	snap_a = calculate_user_vacation_snapshot(db_session, user_a)
	snap_b = calculate_user_vacation_snapshot(db_session, user_b)
	assert snap_a["used_days"] >= 1.0
	assert snap_b["used_days"] == 0.0

	vac_a = (
		db_session.query(UserVacation)
		.filter(UserVacation.tenant_id == tid_a, UserVacation.user_id == "admin")
		.first()
	)
	vac_b = (
		db_session.query(UserVacation)
		.filter(UserVacation.tenant_id == tid_b, UserVacation.user_id == "admin")
		.first()
	)
	if vac_a:
		assert vac_a.used_days >= 1.0
	if vac_b is None or vac_b.used_days == 0.0:
		pass
	else:
		assert vac_b.used_days == 0.0


def test_cross_tenant_rows_have_distinct_tenant_id(db_session, two_tenants_with_shared_admin):
	tid_a, tid_b = two_tenants_with_shared_admin
	work_date = date(2026, 8, 1)
	week_start = date(2026, 8, 4)

	hr_reports.upsert_daily(db_session, tid_a, "admin", work_date, "A")
	hr_reports.upsert_daily(db_session, tid_b, "admin", work_date, "B")
	hr_reports.upsert_weekly(db_session, tid_a, "admin", week_start, "WA")
	hr_reports.upsert_weekly(db_session, tid_b, "admin", week_start, "WB")

	daily_rows = db_session.query(DailyReport).filter(DailyReport.user_id == "admin").all()
	weekly_rows = db_session.query(WeeklyReport).filter(WeeklyReport.user_id == "admin").all()
	assert len(daily_rows) == 2
	assert {int(r.tenant_id) for r in daily_rows} == {tid_a, tid_b}
	assert len(weekly_rows) == 2
	assert {int(r.tenant_id) for r in weekly_rows} == {tid_a, tid_b}

	todos_a = (
		db_session.query(Todo)
		.filter(Todo.tenant_id == tid_a, Todo.user_id == "admin")
		.count()
	)
	todos_b = (
		db_session.query(Todo)
		.filter(Todo.tenant_id == tid_b, Todo.user_id == "admin")
		.count()
	)
	assert todos_a == 0
	assert todos_b == 0


def test_work_location_formatting_isolated_by_tenant(db_session, two_tenants_with_shared_admin):
	from models.system_models import WorkLocation
	from services.hr.attendance_service import format_stored_work_location_for_display
	tid_a, tid_b = two_tenants_with_shared_admin

	# Tenant A has location key "MAIN" -> "Seoul Head Office"
	loc_a = WorkLocation(tenant_id=tid_a, location_key="MAIN", location_value="Seoul Head Office")
	# Tenant B has location key "MAIN" -> "New York Branch"
	loc_b = WorkLocation(tenant_id=tid_b, location_key="MAIN", location_value="New York Branch")
	db_session.add_all([loc_a, loc_b])
	db_session.commit()

	# Formatting "MAIN" with tenant_id=tid_a should return "Seoul Head Office"
	val_a = format_stored_work_location_for_display(db_session, tid_a, "MAIN")
	# Formatting "MAIN" with tenant_id=tid_b should return "New York Branch"
	val_b = format_stored_work_location_for_display(db_session, tid_b, "MAIN")

	assert val_a == "Seoul Head Office"
	assert val_b == "New York Branch"


def test_admin_stats_vacation_isolated_by_tenant(db_session, two_tenants_with_shared_admin):
	from services.admin.stats_service import get_admin_stats
	tid_a, tid_b = two_tenants_with_shared_admin
	
	work_day = today_seoul()
	st = datetime.combine(work_day, time(9, 0, 0))
	en = datetime.combine(work_day, time(18, 0, 0))

	from models.hr_models import TodoCategoryType
	for tid in (tid_a, tid_b):
		if db_session.query(TodoCategoryType).filter(TodoCategoryType.tenant_id == tid, TodoCategoryType.category_key == "vacation_full").count() == 0:
			db_session.add(TodoCategoryType(tenant_id=tid, category_key="vacation_full", category_name="연차"))
	db_session.commit()

	# Create a vacation Todo for tid_a
	todo_a = Todo(
		tenant_id=tid_a,
		user_id="admin",
		title="휴가 A",
		start_date=st,
		end_date=en,
		category="vacation_full"
	)
	db_session.add(todo_a)
	db_session.commit()

	# Retrieve stats for both tenants
	stats_a = get_admin_stats(db_session, tid_a)
	stats_b = get_admin_stats(db_session, tid_b)

	# tid_a should see the vacation
	assert stats_a["vacation_count"] == 1
	assert stats_a["today_vacations"][0]["user_name"] == f"Admin {tid_a}"

	# tid_b should not see the vacation
	assert stats_b["vacation_count"] == 0


def test_uploaded_file_download_permission_isolated_by_tenant(db_session, two_tenants_with_shared_admin):
	from fastapi import HTTPException
	from models.common_models import UploadedFile
	from models.message_models import Message, MessageAttachment
	from services.common_service import assert_user_may_download_uploaded_file
	tid_a, tid_b = two_tenants_with_shared_admin

	user_a = db_session.query(User).filter(User.tenant_id == tid_a, User.user_login_id == "admin").one()
	user_b = db_session.query(User).filter(User.tenant_id == tid_b, User.user_login_id == "admin").one()

	# Create uploaded file
	uf = UploadedFile(
		original_name="test.pdf",
		saved_name="abcdef.pdf",
		file_path="/uploads/abcdef.pdf",
		content_type="application/pdf"
	)
	db_session.add(uf)
	db_session.flush()

	# Create message for Tenant A (global notice)
	msg = Message(
		title="Global Notice",
		content="Content",
		is_global=True,
		sender_id=user_a.id
	)
	db_session.add(msg)
	db_session.flush()

	# Attach file to message
	att = MessageAttachment(message_id=msg.id, file_id=uf.id)
	db_session.add(att)
	db_session.commit()

	# User A (Tenant A) should be allowed to download
	current_user_a = {
		"id": user_a.id,
		"userId": user_a.user_login_id,
		"tenantId": tid_a,
		"role": "user"
	}
	assert_user_may_download_uploaded_file(db_session, current_user_a, uf)

	# User B (Tenant B) should NOT be allowed to download
	current_user_b = {
		"id": user_b.id,
		"userId": user_b.user_login_id,
		"tenantId": tid_b,
		"role": "user"
	}
	with pytest.raises(HTTPException) as exc_info:
		assert_user_may_download_uploaded_file(db_session, current_user_b, uf)
	assert exc_info.value.status_code == 403
