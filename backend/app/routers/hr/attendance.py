from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.session import get_db
from controllers.hr import attendance_controller
from schemas.hr import attendance_schemas
from services.auth_service import get_current_user

router = APIRouter()

@router.get("/today", response_model=attendance_schemas.AttendanceResponse | None)
def read_today_attendance(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return attendance_controller.get_my_today_status(db, current_user)

@router.post("/clock-in", response_model=attendance_schemas.AttendanceResponse)
def clock_in(req: attendance_schemas.AttendanceRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return attendance_controller.process_clock_in(db, current_user, req)

@router.post("/clock-out", response_model=attendance_schemas.AttendanceResponse)
def clock_out(req: attendance_schemas.AttendanceRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return attendance_controller.process_clock_out(db, current_user, req)