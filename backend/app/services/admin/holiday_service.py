from datetime import date, datetime
from typing import Literal

import requests
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.config import settings
from models.holiday_models import Holiday
from models.tenant_models import Tenant
from schemas.admin import holiday_schemas
from services.tenant_scope import holidays_in_tenant

PUBLIC_DATA_SYNC_DESCRIPTION = "공공데이터 자동 연동"


def is_shared_public_data_holiday(is_official: bool, description: str | None) -> bool:
	"""법정공휴일 + 공공데이터 연동 비고 → 전 테넌트 공유 대상."""
	return bool(is_official) and (description or "").strip() == PUBLIC_DATA_SYNC_DESCRIPTION


def get_all_holidays(db: Session, tenant_id: int, year: int | None = None):
	"""DB에서 공휴일 목록 조회 (테넌트 스코프)"""
	query = holidays_in_tenant(db, tenant_id)
	if year:
		query = query.filter(func.extract("year", Holiday.holiday_date) == year)
	return query.order_by(Holiday.holiday_date.asc()).all()


def get_holiday_by_date(db: Session, tenant_id: int, holiday_date: date):
	"""날짜 기준 단건 조회 (중복 체크용, 테넌트 내)"""
	return (
		holidays_in_tenant(db, tenant_id)
		.filter(Holiday.holiday_date == holiday_date)
		.first()
	)


def get_holiday_by_id(db: Session, tenant_id: int, holiday_id: int):
	"""ID 기준 단건 조회 (삭제용, 테넌트 내)"""
	return holidays_in_tenant(db, tenant_id).filter(Holiday.id == holiday_id).first()


def _all_tenant_ids(db: Session) -> list[int]:
	return [int(row[0]) for row in db.query(Tenant.id).order_by(Tenant.id.asc()).all()]


def count_all_tenants(db: Session) -> int:
	return len(_all_tenant_ids(db))


def _fetch_public_holiday_items(year: int) -> list[dict]:
	"""공공데이터 API 1회 호출 → 법정 공휴일 목록."""
	url = settings.HOLIDAY_API_URL
	params = {
		"ServiceKey": settings.PUBLIC_DATA_API_KEY,
		"solYear": str(year),
		"numOfRows": "100",
		"_type": "json",
	}

	response = requests.get(url, params=params, timeout=30)
	if response.status_code != 200:
		raise Exception("공공데이터 API 서버 통신 실패")

	data = response.json()
	try:
		items = data["response"]["body"]["items"]["item"]
	except (KeyError, TypeError):
		return []

	if isinstance(items, dict):
		items = [items]

	result: list[dict] = []
	for item in items:
		if item.get("isHoliday") != "Y":
			continue
		date_str = str(item["locdate"])
		formatted_date = datetime.strptime(date_str, "%Y%m%d").date()
		result.append(
			{
				"holiday_date": formatted_date,
				"holiday_name": item["dateName"],
				"is_official": True,
				"description": PUBLIC_DATA_SYNC_DESCRIPTION,
			}
		)
	return result


def _upsert_shared_holiday_for_tenant(
	db: Session,
	tenant_id: int,
	holiday_date: date,
	holiday_name: str,
	is_official: bool,
	description: str | None,
) -> Literal["added", "updated", "skipped"]:
	"""공유 대상 공휴일을 테넌트에 반영(해당 날짜에 회사 휴무 등이 있으면 건너뜀)."""
	existing = get_holiday_by_date(db, tenant_id, holiday_date)
	if existing:
		if is_shared_public_data_holiday(bool(existing.is_official), existing.description):
			existing.holiday_name = holiday_name
			existing.is_official = is_official
			existing.description = description
			return "updated"
		return "skipped"

	db.add(
		Holiday(
			tenant_id=tenant_id,
			holiday_date=holiday_date,
			holiday_name=holiday_name,
			is_official=is_official,
			description=description,
		)
	)
	return "added"


def _replicate_shared_holiday_to_all_tenants(
	db: Session,
	holiday_date: date,
	holiday_name: str,
	is_official: bool,
	description: str | None,
) -> None:
	if not is_shared_public_data_holiday(is_official, description):
		return
	for tid in _all_tenant_ids(db):
		_upsert_shared_holiday_for_tenant(
			db, tid, holiday_date, holiday_name, is_official, description
		)


def create_holiday(db: Session, tenant_id: int, holiday_data: holiday_schemas.HolidayCreate):
	"""DB에 공휴일 저장. 공공데이터 연동 법정공휴일이면 전 테넌트에 복제."""
	payload = holiday_data.model_dump()
	if is_shared_public_data_holiday(payload["is_official"], payload.get("description")):
		_replicate_shared_holiday_to_all_tenants(
			db,
			payload["holiday_date"],
			payload["holiday_name"],
			payload["is_official"],
			payload.get("description"),
		)
		db.commit()
		return get_holiday_by_date(db, tenant_id, payload["holiday_date"])

	new_holiday = Holiday(tenant_id=tenant_id, **payload)
	db.add(new_holiday)
	db.commit()
	db.refresh(new_holiday)
	return new_holiday


def update_holiday(
	db: Session,
	tenant_id: int,
	holiday_id: int,
	holiday_data: holiday_schemas.HolidayUpdate,
):
	"""공휴일 수정. 공공데이터 연동 법정공휴일이면 전 테넌트 동일 날짜 레코드 동기화."""
	holiday = get_holiday_by_id(db, tenant_id, holiday_id)
	if not holiday:
		return None

	was_shared = is_shared_public_data_holiday(
		bool(holiday.is_official), holiday.description
	)
	updates = holiday_data.model_dump(exclude_unset=True)
	for key, value in updates.items():
		setattr(holiday, key, value)

	if was_shared or is_shared_public_data_holiday(
		bool(holiday.is_official), holiday.description
	):
		_replicate_shared_holiday_to_all_tenants(
			db,
			holiday.holiday_date,
			holiday.holiday_name,
			bool(holiday.is_official),
			holiday.description,
		)

	db.commit()
	db.refresh(holiday)
	return holiday


def remove_holiday(db: Session, holiday: Holiday):
	"""DB에서 공휴일 삭제 (해당 테넌트만, 공유 복제 없음)."""
	db.delete(holiday)
	db.commit()
	return True


def sync_public_holidays(db: Session, tenant_id: int, year: int):
	"""공공데이터 API 1회 호출 후 모든 테넌트에 미등록 일자만 추가."""
	_ = tenant_id  # API 호환용(요청 테넌트와 무관하게 전체 반영)
	items = _fetch_public_holiday_items(year)
	if not items:
		db.commit()
		return 0

	added_count = 0
	for tid in _all_tenant_ids(db):
		for item in items:
			if (
				_upsert_shared_holiday_for_tenant(
					db,
					tid,
					item["holiday_date"],
					item["holiday_name"],
					item["is_official"],
					item["description"],
				)
				== "added"
			):
				added_count += 1

	db.commit()
	return added_count
