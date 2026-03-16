from sqlalchemy.orm import Session
from datetime import date, datetime
# ✅ 모듈 안의 특정 클래스들을 직접 임포트합니다.
from app.models.hr_models import Attendance

# 1. 특정 날짜의 내 출퇴근 기록 조회
def get_today_attendance(db: Session, user_id: str, today_date: date):
    """오늘 날짜와 사용자 ID로 기존 출퇴근 레코드가 있는지 확인합니다."""
    return db.query(Attendance).filter(
        Attendance.user_id == user_id, 
        Attendance.work_date == today_date
    ).first()

# 2. 출근 데이터 생성 (Create)
def create_clock_in(db: Session, user_id: str, current_time: datetime, status: str, location: str, lat: float, lng: float, note: str = None):
    """새로운 출퇴근 레코드를 생성하고 출근 정보를 기록합니다."""
    new_record = Attendance(
        user_id=user_id,
        work_date=current_time.date(),
        clock_in_time=current_time,
        clock_in_location=location, # 선택한 출근 장소 (본사, 재택 등)
        clock_in_lat=lat,           # 출근 시 위도
        clock_in_lng=lng,           # 출근 시 경도
        status=status,              # 현재 "NORMAL"로 고정
        note=note
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record

# 3. 퇴근 데이터 업데이트 (Update)
def update_clock_out(db: Session, record: Attendance, current_time: datetime, status: str, location: str, lat: float, lng: float, note: str = None):
    """기존 레코드에 퇴근 정보를 업데이트하고 총 근무 시간을 계산합니다."""
    record.clock_out_time = current_time
    record.clock_out_location = location # 선택한 퇴근 장소 (본사, 출장 등)
    record.clock_out_lat = lat           # 퇴근 시 위도
    record.clock_out_lng = lng           # 퇴근 시 경도
    
    if note:
        record.note = note # 메모가 새로 들어오면 갱신

    # ⏱️ 총 근무 시간(분) 계산
    # 퇴근 시간 - 출근 시간 후 초 단위 차이를 60으로 나누어 '분' 단위 정수로 저장
    time_diff = current_time - record.clock_in_time
    total_minutes = int(time_diff.total_seconds() / 60)
    
    record.work_minutes = total_minutes
    record.status = status # 필요 시 상태 업데이트 (현재는 "NORMAL" 유지)

    db.commit()
    db.refresh(record)
    return record