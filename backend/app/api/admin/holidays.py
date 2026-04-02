import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from db.session import get_db
from services.auth_service import get_current_admin, get_current_user
from services.admin import holiday_service as service
from schemas.admin.holiday_schemas import HolidayCreate, HolidayOut

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=List[HolidayOut])
def list_holidays(year: int | None = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
	return service.get_all_holidays(db, year)

@router.post("/", response_model=HolidayOut)
def create_holiday(holiday_data: HolidayCreate, db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
	existing = service.get_holiday_by_date(db, holiday_data.holiday_date)
	if existing:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="해당 날짜에 이미 등록된 공휴일이나 휴무일이 존재합니다.")
	return service.create_holiday(db, holiday_data)

@router.delete("/{holiday_id}")
def delete_holiday(holiday_id: int, db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
	holiday = service.get_holiday_by_id(db, holiday_id)
	if not holiday:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="삭제하려는 공휴일 정보를 찾을 수 없습니다.")
	service.remove_holiday(db, holiday)
	return {"success": True, "message": f"[{holiday.holiday_name}]이(가) 성공적으로 삭제되었습니다."}

@router.post("/sync/{year}")
def sync_public_holidays(year: int, db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
	try:
		added_count = service.sync_public_holidays(db, year)
		return {
			"success": True,
			"message": f"{year}년 공휴일 총 {added_count}건이 동기화되었습니다.",
			"added_count": added_count
		}
	except Exception:
		logger.exception("Failed to sync public holidays")
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="공휴일 동기화 중 서버 오류가 발생했습니다."
		)