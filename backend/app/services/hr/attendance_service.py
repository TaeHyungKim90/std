from datetime import date, datetime, time

from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from models.hr_models import Attendance, Todo
from models.auth_models import User

_VACATION_TODO_CATEGORIES = [
	"vacation_full",
	"vacation_am",
	"vacation_pm",
	"vacation_special",
	"vacation_sick",
	"official_leave",
]


def is_vacation_status(status_str: str | None) -> bool:
	"""Attendance.status 문자열 기반 휴가 키워드 판별."""
	if status_str is None:
		return False
	s = str(status_str)
	s_upper = s.upper()
	return (
		"VACATION" in s_upper
		or "VAC" in s_upper
		or "휴가" in s
		or "연차" in s
		or "병가" in s
	)


def _is_user_on_vacation_by_todos(db: Session, user_id: str, target_date: date) -> bool:
	day_start = datetime.combine(target_date, time.min)
	day_end = datetime.combine(target_date, time.max)
	q = (
		db.query(Todo.id)
		.filter(Todo.user_id == user_id)
		.filter(Todo.category.in_(_VACATION_TODO_CATEGORIES))
		.filter(Todo.start_date <= day_end)
		.filter(or_(Todo.end_date == None, Todo.end_date >= day_start))  # noqa: E711
	)
	return q.first() is not None


def assert_user_can_clock_in(db: Session, user_id: str, current_time: datetime) -> None:
	"""출근(clock-in) 최상단 방어 로직.

	1) 입사일 미등록자 차단
	2) 오늘이 휴가면 차단
	"""
	user = db.query(User).filter(User.user_login_id == user_id).first()
	if not user or user.join_date is None:
		raise HTTPException(
			status_code=400,
			detail="입사일이 등록되지 않은 계정은 출근할 수 없습니다.",
		)

	today_date = current_time.date()

	# 이미 존재하는 Attendance가 휴가 상태면 차단
	record = get_today_attendance(db, user_id, today_date)
	if record and is_vacation_status(record.status):
		raise HTTPException(
			status_code=400,
			detail="휴가 중에는 출근을 기록할 수 없습니다.",
		)

	# HR todos(연차/휴가 일정)로도 휴가면 차단
	if _is_user_on_vacation_by_todos(db, user_id, today_date):
		raise HTTPException(
			status_code=400,
			detail="휴가 중에는 출근을 기록할 수 없습니다.",
		)

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
	# 최상단 방어 로직: 입사일 미등록자/휴가자 차단
	assert_user_can_clock_in(db, user_id, current_time)

	new_record = Attendance(
		user_id=user_id,
		work_date=current_time.date(),
		clock_in_time=current_time,
		clock_in_location=location, # 선택한 출근 장소 (본사, 재택 등)
		clock_in_lat=lat,			# 출근 시 위도
		clock_in_lng=lng,			# 출근 시 경도
		status=status,				# 현재 "NORMAL"로 고정
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
	record.clock_out_lat = lat			 # 퇴근 시 위도
	record.clock_out_lng = lng			 # 퇴근 시 경도
	
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