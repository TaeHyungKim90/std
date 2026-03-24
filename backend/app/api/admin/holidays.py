from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from db.session import get_db
from services.auth_service import get_current_admin, get_current_user
from services.admin import holiday_service as service
from schemas.admin.holiday_schemas import HolidayCreate, HolidayOut

router = APIRouter(prefix="/admin/holidays", tags=["Admin Holidays"])

@router.get("/", response_model=List[HolidayOut])
def list_holidays(year: int = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return service.get_all_holidays(db, year)

@router.post("/", response_model=HolidayOut)
def add_holiday(holiday_data: HolidayCreate, db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
    existing = service.get_holiday_by_date(db, holiday_data.holiday_date)
    if existing:
        raise HTTPException(status_code=400, detail="해당 날짜에 이미 등록된 휴일이 존재합니다.")
    return service.create_holiday(db, holiday_data)

@router.delete("/{holiday_id}")
def remove_holiday(holiday_id: int, db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
    holiday = service.get_holiday_by_id(db, holiday_id)
    if not holiday:
        raise HTTPException(status_code=404, detail="휴일 정보를 찾을 수 없습니다.")
    service.remove_holiday(db, holiday)
    return {"success": True, "message": "삭제되었습니다."}

@router.post("/sync/{year}")
def sync_public_holidays(year: int, db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
    return service.sync_holidays_from_api(db, year)