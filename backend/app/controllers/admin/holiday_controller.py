from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from services.admin import holiday_service as service # 👈 세분화된 서비스 경로
from schemas.admin import holiday_schemas

def get_holidays(db: Session, year: int):
    return service.get_all_holidays(db, year)

def create_holiday(db: Session, holiday_data: holiday_schemas.HolidayCreate):
    # 1. 이미 해당 날짜에 데이터가 있는지 서비스에 물어봄
    existing = service.get_holiday_by_date(db, holiday_data.holiday_date)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="해당 날짜에 이미 등록된 공휴일이나 휴무일이 존재합니다."
        )
    
    # 2. 없으면 저장 명령
    return service.create_holiday(db, holiday_data)

def delete_holiday(db: Session, holiday_id: int):
    # 1. 삭제할 대상이 있는지 먼저 확인
    holiday = service.get_holiday_by_id(db, holiday_id)
    if not holiday:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="삭제하려는 공휴일 정보를 찾을 수 없습니다."
        )
    
    # 2. 삭제 실행
    service.remove_holiday(db, holiday)
    return {"success": True, "message": f"[{holiday.holiday_name}]이(가) 성공적으로 삭제되었습니다."}

def sync_holidays_from_api(db: Session, year: int):
    try:
        added_count = service.sync_public_holidays(db, year)
        return {
            "success": True,
            "message": f"{year}년 공휴일 총 {added_count}건이 동기화되었습니다.",
            "added_count": added_count
        }
    except Exception as e:
        # 서비스에서 발생한 에러를 500 에러로 변환하여 클라이언트에 전달
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"API 연동 중 오류 발생: {str(e)}"
        )