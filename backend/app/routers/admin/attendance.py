# app/routers/admin/attendance.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from app.controllers.admin import attendance_controller as controller
from database import get_db
from app.services.auth_service import get_current_admin

router = APIRouter(tags=["Admin Attendance"])

@router.get("/all")
def get_all_attendance(user_name: Optional[str] = None, work_date: Optional[str] = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return controller.get_all_attendance(db, user_name, work_date)