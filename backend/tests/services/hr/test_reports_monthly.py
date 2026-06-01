"""월간 보고 서비스 단위 테스트."""

from datetime import date
from typing import cast

import pytest
from fastapi import HTTPException

from models.auth_models import User
from models.hr_models import MonthlyReport
from services.hr import reports_service
from support.memory_db import memory_db_session


@pytest.fixture()
def db_session():
	with memory_db_session() as s:
		yield s


@pytest.fixture()
def user_joined(db_session):
	u = User(
		id=1,
		user_login_id="monthly_user",
		tenant_id=1,
		user_password="x",
		user_name="Monthly User",
		join_date=date(2020, 1, 1),
	)
	db_session.add(u)
	db_session.commit()
	return u


def test_first_of_month_normalizes():
	assert reports_service.first_of_month(date(2025, 7, 15)) == date(2025, 7, 1)


def test_upsert_and_get_monthly(db_session, user_joined):
	ms = date(2025, 8, 1)
	row = reports_service.upsert_monthly(db_session, 1, "monthly_user", ms, "8월 요약")
	assert row.summary == "8월 요약"
	got = reports_service.get_monthly(db_session, 1, "monthly_user", date(2025, 8, 15))
	assert got is not None
	assert cast(str, got.summary) == "8월 요약"


def test_upsert_normalizes_mid_month_to_first(db_session, user_joined):
	row = reports_service.upsert_monthly(db_session, 1, "monthly_user", date(2025, 9, 20), "9월")
	assert cast(date, row.month_start_date) == date(2025, 9, 1)


def test_upsert_rejects_after_resignation(db_session):
	u = User(
		id=2,
		user_login_id="resigned",
		tenant_id=1,
		user_password="x",
		user_name="Resigned",
		join_date=date(2020, 1, 1),
		resignation_date=date(2025, 6, 30),
	)
	db_session.add(u)
	db_session.commit()
	with pytest.raises(HTTPException) as exc:
		reports_service.upsert_monthly(
			db_session,
			1,
			"resigned",
			date(2025, 7, 1),
			"too late",
		)
	assert exc.value.status_code == 400


def test_get_monthly_none_when_month_after_resignation(db_session):
	u = User(
		id=3,
		user_login_id="resigned2",
		tenant_id=1,
		user_password="x",
		user_name="Resigned2",
		join_date=date(2020, 1, 1),
		resignation_date=date(2025, 6, 30),
	)
	db_session.add(u)
	db_session.commit()
	db_session.add(
		MonthlyReport(
			user_id="resigned2",
			month_start_date=date(2025, 6, 1),
			summary="6월",
		)
	)
	db_session.commit()
	assert reports_service.get_monthly(db_session, 1, "resigned2", date(2025, 7, 1)) is None
	assert reports_service.get_monthly(db_session, 1, "resigned2", date(2025, 6, 1)) is not None
