"""동일 user_login_id가 두 테넌트에 있을 때 HR 활동 데이터가 섞이지 않는지 검증."""

from datetime import date, datetime, time

import pytest

from models.auth_models import User, UserVacation
from models.hr_models import DailyReport, Todo, WeeklyReport
from models.tenant_models import Tenant
from services.admin import reports_service as admin_reports
from services.admin.user_service import calculate_user_vacation_snapshot
from services.hr import reports_service as hr_reports
from services.hr import todos_service
from schemas.hr.todos_schemas import TodoCreate
from support.memory_db import memory_db_session


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
