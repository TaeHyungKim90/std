from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime
from app.services.hr import attendance_service

# 출근 처리 로직
def process_clock_in(db: Session, current_user: dict, req: any):
    user_id = current_user.get("userId")
    now = datetime.now()
    # 중복 출근 체크
    if attendance_service.get_today_attendance(db, user_id, now.date()):
        raise HTTPException(status_code=400, detail="이미 출근 기록이 존재합니다.")
    status = "NORMAL"
    return attendance_service.create_clock_in(db, user_id, now, status, location=req.location_name, lat=req.latitude, lng=req.longitude, note=req.note)

# 퇴근 처리 로직
def process_clock_out(db: Session, current_user: dict, req: any):
    user_id = current_user.get("userId")
    now = datetime.now()
    record = attendance_service.get_today_attendance(db, user_id, now.date())
    if not record:
        raise HTTPException(status_code=400, detail="출근 기록을 찾을 수 없습니다. 먼저 출근을 해주세요.")
    if record.clock_out_time:
        raise HTTPException(status_code=400, detail="이미 퇴근 처리가 완료되었습니다.")
    status = record.status 
    return attendance_service.update_clock_out(db, record, now, status, location=req.location_name, lat=req.latitude, lng=req.longitude, note=req.note)

# 오늘 내 출퇴근 상태 조회 (화면 그리기 용)
def get_my_today_status(db: Session, current_user: dict):
    user_id = current_user.get("userId")
    now = datetime.now()
    return attendance_service.get_today_attendance(db, user_id, now.date())