from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.services import holiday_service
from app.schemas import holiday_schemas

def get_holidays(db: Session, year: int):
    """특정 연도의 모든 공휴일 조회"""
    return holiday_service.get_all_holidays(db, year)

def create_holiday(db: Session, holiday_data: holiday_schemas.HolidayCreate):
    """신규 공휴일 등록 (중복 검증 포함)"""
    # 1. 동일 날짜 존재 여부 확인
    existing = holiday_service.get_holiday_by_date(db, holiday_data.holiday_date)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="해당 날짜에 이미 등록된 공휴일/휴무일이 있습니다."
        )
    
    # 2. 서비스 레이어 호출하여 저장
    return holiday_service.create_holiday(db, holiday_data)

def delete_holiday(db: Session, holiday_id: int):
    """공휴일 삭제 (존재 여부 확인 포함)"""
    holiday = holiday_service.get_holiday_by_id(db, holiday_id)
    if not holiday:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="요청하신 공휴일 정보를 찾을 수 없습니다."
        )
    
    holiday_service.delete_holiday(db, holiday)
    return {"success": True, "message": "성공적으로 삭제되었습니다."}

def sync_holidays_from_api(db: Session, year: int):
    """공공데이터 API 연동 및 DB 동기화"""
    try:
        # 서비스에서 실제 통신 및 저장을 수행하고 추가된 개수를 반환받음
        added_count = holiday_service.sync_public_holidays(db, year)
        
        return {
            "success": True, 
            "message": f"{year}년 공휴일 {added_count}건이 동기화되었습니다.", 
            "added_count": added_count
        }
    except ValueError as ve:
        # 서비스 레이어에서 유효하지 않은 연도 등이 들어왔을 때 던지는 에러 처리
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        # 그 외 API 통신 장애 등 서버 내부 에러 처리
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"공휴일 연동 중 서버 오류가 발생했습니다: {str(e)}"
        )