"""법정공휴일(공공데이터 연동) 전 테넌트 공유."""

from datetime import date

import pytest

from models.holiday_models import Holiday
from support.memory_db import memory_db_session
from models.tenant_models import Tenant
from schemas.admin.holiday_schemas import HolidayCreate, HolidayUpdate
from services.admin.holiday_service import (
	PUBLIC_DATA_SYNC_DESCRIPTION,
	count_all_tenants,
	create_holiday,
	get_holiday_by_date,
	remove_holiday,
	sync_public_holidays,
	update_holiday,
)


@pytest.fixture()
def db_session():
	with memory_db_session() as session:
		yield session


@pytest.fixture
def two_tenants(db_session):
	t1 = Tenant(slug="holiday-t1", name="Holiday T1", is_active=True)
	t2 = Tenant(slug="holiday-t2", name="Holiday T2", is_active=True)
	db_session.add_all([t1, t2])
	db_session.commit()
	db_session.refresh(t1)
	db_session.refresh(t2)
	return int(t1.id), int(t2.id)


def test_shared_create_replicates_to_all_tenants(db_session, two_tenants):
	tid1, tid2 = two_tenants
	d = date(2030, 3, 1)

	create_holiday(
		db_session,
		tid1,
		HolidayCreate(
			holiday_date=d,
			holiday_name="삼일절",
			is_official=True,
			description=PUBLIC_DATA_SYNC_DESCRIPTION,
		),
	)

	h1 = get_holiday_by_date(db_session, tid1, d)
	h2 = get_holiday_by_date(db_session, tid2, d)
	assert h1 is not None
	assert h2 is not None
	assert h1.holiday_name == "삼일절"
	assert h2.description == PUBLIC_DATA_SYNC_DESCRIPTION


def test_company_holiday_does_not_replicate(db_session, two_tenants):
	tid1, tid2 = two_tenants
	d = date(2030, 5, 5)

	create_holiday(
		db_session,
		tid1,
		HolidayCreate(
			holiday_date=d,
			holiday_name="창립기념일",
			is_official=False,
			description="회사 행사",
		),
	)

	assert get_holiday_by_date(db_session, tid1, d) is not None
	assert get_holiday_by_date(db_session, tid2, d) is None


def test_delete_only_affects_one_tenant(db_session, two_tenants):
	tid1, tid2 = two_tenants
	d = date(2030, 6, 6)
	create_holiday(
		db_session,
		tid1,
		HolidayCreate(
			holiday_date=d,
			holiday_name="현충일",
			is_official=True,
			description=PUBLIC_DATA_SYNC_DESCRIPTION,
		),
	)
	row = get_holiday_by_date(db_session, tid1, d)
	remove_holiday(db_session, row)

	assert get_holiday_by_date(db_session, tid1, d) is None
	assert get_holiday_by_date(db_session, tid2, d) is not None


def test_shared_update_replicates(db_session, two_tenants):
	tid1, tid2 = two_tenants
	d = date(2030, 8, 15)
	create_holiday(
		db_session,
		tid1,
		HolidayCreate(
			holiday_date=d,
			holiday_name="광복절",
			is_official=True,
			description=PUBLIC_DATA_SYNC_DESCRIPTION,
		),
	)
	row = get_holiday_by_date(db_session, tid1, d)
	update_holiday(
		db_session,
		tid1,
		int(row.id),
		HolidayUpdate(holiday_name="광복절(수정)"),
	)

	assert get_holiday_by_date(db_session, tid1, d).holiday_name == "광복절(수정)"
	assert get_holiday_by_date(db_session, tid2, d).holiday_name == "광복절(수정)"


def test_sync_public_holidays_all_tenants(monkeypatch, db_session, two_tenants):
	tid1, tid2 = two_tenants

	def fake_fetch(_year: int):
		return [
			{
				"holiday_date": date(2031, 1, 1),
				"holiday_name": "신정",
				"is_official": True,
				"description": PUBLIC_DATA_SYNC_DESCRIPTION,
			}
		]

	monkeypatch.setattr(
		"services.admin.holiday_service._fetch_public_holiday_items",
		fake_fetch,
	)

	tenant_n = count_all_tenants(db_session)
	added = sync_public_holidays(db_session, tid1, 2031)
	assert added == tenant_n
	assert get_holiday_by_date(db_session, tid1, date(2031, 1, 1)) is not None
	assert get_holiday_by_date(db_session, tid2, date(2031, 1, 1)) is not None

	added_again = sync_public_holidays(db_session, tid2, 2031)
	assert added_again == 0
