# app/routers/admin/holidays.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.controllers.admin import holiday_controller as controller
from database import get_db
from app.services.auth_service import get_current_admin, get_current_user
from app.schemas.admin.holiday_schemas import HolidayCreate, HolidayOut

router = APIRouter(tags=["Admin Holidays"])

@router.get("/", response_model=List[HolidayOut])
def list_holidays(year: int = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return controller.get_holidays(db, year)

@router.post("/", response_model=HolidayOut)
def add_holiday(holiday_data: HolidayCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return controller.create_holiday(db, holiday_data)

@router.delete("/{holiday_id}")
def remove_holiday(holiday_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return controller.delete_holiday(db, holiday_id)

@router.post("/sync/{year}")
def sync_public_holidays(year: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return controller.sync_holidays_from_api(db, year)