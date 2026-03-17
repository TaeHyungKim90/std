import requests
from sqlalchemy.orm import Session
from app.models.holiday_models import Holiday
from app.schemas import holiday_schemas
from datetime import datetime
from config import settings

def get_all_holidays(db: Session, year: int = None):
    """DB에서 공휴일 전체 또는 특정 연도 목록을 조회"""
    query = db.query(Holiday)
    if year:
        query = query.filter(Holiday.holiday_date >= f"{year}-01-01", 
                             Holiday.holiday_date <= f"{year}-12-31")
    return query.order_by(Holiday.holiday_date.asc()).all()

def get_holiday_by_date(db: Session, holiday_date):
    """날짜를 기준으로 공휴일 단건 조회 (중복 검사용)"""
    return db.query(Holiday).filter(Holiday.holiday_date == holiday_date).first()

def get_holiday_by_id(db: Session, holiday_id: int):
    """ID를 기준으로 공휴일 단건 조회 (삭제 검사용)"""
    return db.query(Holiday).filter(Holiday.id == holiday_id).first()

def create_holiday(db: Session, holiday_data: holiday_schemas.HolidayCreate):
    """DB에 새로운 공휴일 Insert"""
    new_holiday = Holiday(**holiday_data.model_dump()) # pydantic v2 기준 (v1일 경우 dict() 사용)
    db.add(new_holiday)
    db.commit()
    db.refresh(new_holiday)
    return new_holiday

def delete_holiday(db: Session, holiday: Holiday):
    """DB에서 공휴일 Delete"""
    db.delete(holiday)
    db.commit()
    return True

def sync_public_holidays(db: Session, year: int):
    """
    공공데이터포털(한국천문연구원 특일정보) API를 호출하여 공휴일을 동기화합니다.
    """
    url = "http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo"
    params = {
        "ServiceKey": settings.PUBLIC_DATA_API_KEY, # URL Encoding된 키라면 requests 모듈이 한 번 더 인코딩하지 않도록 주의가 필요할 수 있습니다.
        "solYear": str(year),
        "numOfRows": "100", # 1년치 공휴일은 보통 20개 미만이므로 100이면 충분합니다.
        "_type": "json"
    }

    response = requests.get(url, params=params)
    
    if response.status_code != 200:
        raise Exception("공공데이터 API 서버와 통신할 수 없습니다.")

    data = response.json()
    
    try:
        # 데이터 구조 접근
        items = data['response']['body']['items']['item']
    except (KeyError, TypeError):
        return 0 # 해당 연도에 데이터가 없거나 형식이 다름

    # 공공데이터 API 특성상 결과가 1개일 경우 리스트가 아닌 딕셔너리로 반환되므로 리스트로 감싸줌
    if isinstance(items, dict):
        items = [items]

    added_count = 0
    for item in items:
        # isHoliday 값이 'Y'인 것만 공휴일로 취급
        if item.get('isHoliday') == 'Y':
            date_str = str(item['locdate']) # '20260505' 형태
            formatted_date = datetime.strptime(date_str, '%Y%m%d').date() # 'YYYY-MM-DD'로 변환
            name = item['dateName']

            # 이미 DB에 등록된 날짜인지 중복 확인
            existing = get_holiday_by_date(db, formatted_date)
            if not existing:
                new_holiday = Holiday(
                    holiday_date=formatted_date,
                    holiday_name=name,
                    is_official=True,
                    description="공공데이터 자동 연동"
                )
                db.add(new_holiday)
                added_count += 1

    db.commit()
    return added_count