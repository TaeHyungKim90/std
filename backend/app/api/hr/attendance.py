from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from db.session import get_db
from services.auth_service import get_current_user
from services.hr import attendance_service as service
from schemas.hr import attendance_schemas

router = APIRouter()

@router.get("/today", response_model=attendance_schemas.AttendanceResponse | None)
def read_today_attendance(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
	"""[유저] 오늘의 출퇴근 기록을 조회합니다."""
	user_id = current_user.get("userId")
	now = datetime.now()
	return service.get_today_attendance(db, user_id, now.date())

@router.post("/clock-in", response_model=attendance_schemas.AttendanceResponse)
def clock_in(req: attendance_schemas.AttendanceRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
	"""[유저] 출근 처리 (중복 출근 방지 로직 포함)"""
	user_id = current_user.get("userId")
	now = datetime.now()
	
	if service.get_today_attendance(db, user_id, now.date()):
		raise HTTPException(status_code=400, detail="이미 출근 기록이 존재합니다.")
	
	return service.create_clock_in(db, user_id, now, status="NORMAL", location=req.location_name, lat=req.latitude, lng=req.longitude, note=req.note)

@router.post("/clock-out", response_model=attendance_schemas.AttendanceResponse)
def clock_out(req: attendance_schemas.AttendanceRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
	"""[유저] 퇴근 처리 (출근 기록 확인 및 중복 퇴근 방지)"""
	user_id = current_user.get("userId")
	now = datetime.now()
	
	record = service.get_today_attendance(db, user_id, now.date())
	if not record:
		raise HTTPException(status_code=400, detail="출근 기록을 찾을 수 없습니다. 먼저 출근을 해주세요.")
	if record.clock_out_time:
		raise HTTPException(status_code=400, detail="이미 퇴근 처리가 완료되었습니다.")
	status = record.status
	
	return service.update_clock_out(db, record, now, status, location=req.location_name, lat=req.latitude, lng=req.longitude, note=req.note)