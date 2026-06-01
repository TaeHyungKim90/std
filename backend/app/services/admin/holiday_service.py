import requests
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from models.holiday_models import Holiday
from schemas.admin import holiday_schemas
from core.config import settings
from services.tenant_scope import holidays_in_tenant


def get_all_holidays(db: Session, tenant_id: int, year: int | None = None):
	"""DB에서 공휴일 목록 조회 (테넌트 스코프)"""
	query = holidays_in_tenant(db, tenant_id)
	if year:
		query = query.filter(func.extract("year", Holiday.holiday_date) == year)
	return query.order_by(Holiday.holiday_date.asc()).all()


def get_holiday_by_date(db: Session, tenant_id: int, holiday_date):
	"""날짜 기준 단건 조회 (중복 체크용, 테넌트 내)"""
	return (
		holidays_in_tenant(db, tenant_id)
		.filter(Holiday.holiday_date == holiday_date)
		.first()
	)


def get_holiday_by_id(db: Session, tenant_id: int, holiday_id: int):
	"""ID 기준 단건 조회 (삭제용, 테넌트 내)"""
	return holidays_in_tenant(db, tenant_id).filter(Holiday.id == holiday_id).first()


def create_holiday(db: Session, tenant_id: int, holiday_data: holiday_schemas.HolidayCreate):
	"""DB에 공휴일 정보 저장"""
	new_holiday = Holiday(tenant_id=tenant_id, **holiday_data.model_dump())
	db.add(new_holiday)
	db.commit()
	db.refresh(new_holiday)
	return new_holiday


def remove_holiday(db: Session, holiday: Holiday):
	"""DB에서 공휴일 삭제"""
	db.delete(holiday)
	db.commit()
	return True


def sync_public_holidays(db: Session, tenant_id: int, year: int):
	"""공공데이터 API 호출 및 데이터 가공/저장 (테넌트별)"""
	url = settings.HOLIDAY_API_URL
	params = {
		"ServiceKey": settings.PUBLIC_DATA_API_KEY,
		"solYear": str(year),
		"numOfRows": "100",
		"_type": "json",
	}

	response = requests.get(url, params=params)
	if response.status_code != 200:
		raise Exception("공공데이터 API 서버 통신 실패")

	data = response.json()
	try:
		items = data["response"]["body"]["items"]["item"]
	except (KeyError, TypeError):
		return 0

	if isinstance(items, dict):
		items = [items]

	added_count = 0
	for item in items:
		if item.get("isHoliday") == "Y":
			date_str = str(item["locdate"])
			formatted_date = datetime.strptime(date_str, "%Y%m%d").date()

			if not get_holiday_by_date(db, tenant_id, formatted_date):
				new_h = Holiday(
					tenant_id=tenant_id,
					holiday_date=formatted_date,
					holiday_name=item["dateName"],
					is_official=True,
					description="공공데이터 자동 연동",
				)
				db.add(new_h)
				added_count += 1

	db.commit()
	return added_count
