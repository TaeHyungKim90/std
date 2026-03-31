from datetime import datetime, date as date_type, time as time_type

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from models.hr_models import Attendance
from models.auth_models import User

def get_all_attendance(
	db: Session,
	user_name: str = None,
	work_date: str = None,
	skip: int = 0,
	limit: int = 20,
):
	"""
	[관리자] 일일 근태 조회

	- 조회 기준(Base)은 User
	- work_date에 해당하는 Attendance만 outer join으로 붙임
	- 해당일 기준 정상 재직자만 필터링(입사일 <= work_date, 퇴사일 >= work_date 또는 NULL)
	- Attendance가 없는 유저는 clock_in_time/id 등이 None으로 오더라도 dict로 안전 반환
	"""

	def _parse_ymd(ymd: str | None) -> date_type | None:
		if not ymd:
			return None
		if isinstance(ymd, date_type):
			return ymd
		if isinstance(ymd, str):
			try:
				return datetime.strptime(ymd, "%Y-%m-%d").date()
			except ValueError:
				# 프론트가 'YYYY-MM-DD'를 주지 않는 경우 대비(기존 로직 호환용)
				return None
		return None

	parsed_work_date = _parse_ymd(work_date)
	if parsed_work_date is None:
		# work_date가 없거나 파싱이 실패하면 "오늘"을 기본으로 사용
		parsed_work_date = datetime.now().date()

	# User 기준 + 지정 work_date에 해당하는 Attendance만 outer join
	query = (
		db.query(
			User.user_login_id.label("user_id"),
			User.user_name.label("user_name"),
			Attendance.id.label("id"),
			Attendance.work_date.label("work_date"),
			Attendance.clock_in_time.label("clock_in_time"),
			Attendance.clock_out_time.label("clock_out_time"),
			Attendance.clock_in_location.label("clock_in_location"),
			Attendance.clock_out_location.label("clock_out_location"),
			Attendance.work_minutes.label("work_minutes"),
			Attendance.status.label("status"),
		)
		.outerjoin(
			Attendance,
			(Attendance.user_id == User.user_login_id) & (Attendance.work_date == parsed_work_date),
		)
		.filter(
			User.join_date.isnot(None),  # 입사일 미등록자 제외
			User.join_date <= parsed_work_date,
			or_(User.resignation_date == None, User.resignation_date >= parsed_work_date),  # noqa: E711
		)
	)

	if user_name:
		query = query.filter(
			(User.user_name.contains(user_name))
			| (User.user_login_id.contains(user_name))
		)

	# total은 "중복 없이" 재직자 수 기준으로 잡음 (outer join으로 인한 중복 방지용)
	total = query.with_entities(User.user_login_id).distinct().count()

	results = (
		query.order_by(
			Attendance.clock_in_time.desc().nullslast(),
			User.user_name.asc(),
		)
		.offset(skip)
		.limit(limit)
		.all()
	)

	# RowMapping -> dict 안전 변환
	items = [dict(row._mapping) for row in results]
	return {"items": items, "total": total}


def _parse_range_dates(start_str: str | None, end_str: str | None) -> tuple[date_type, date_type]:
	if not start_str or not end_str:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="start_date와 end_date는 YYYY-MM-DD 형식으로 모두 필요합니다.",
		)
	try:
		start_d = datetime.strptime(start_str, "%Y-%m-%d").date()
		end_d = datetime.strptime(end_str, "%Y-%m-%d").date()
	except ValueError:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)",
		)
	if start_d > end_d:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="start_date는 end_date보다 이전이어야 합니다.",
		)
	return start_d, end_d


def get_user_attendance_range(
	db: Session,
	user_login_id: str,
	start_date: str | None,
	end_date: str | None,
) -> dict:
	"""특정 직원의 근태 기록을 기간(포함)으로 조회."""
	start_d, end_d = _parse_range_dates(start_date, end_date)

	records = (
		db.query(Attendance)
		.filter(
			Attendance.user_id == user_login_id,
			Attendance.work_date >= start_d,
			Attendance.work_date <= end_d,
		)
		.order_by(Attendance.work_date.asc(), Attendance.id.asc())
		.all()
	)

	items = [
		{
			"id": r.id,
			"user_id": r.user_id,
			"work_date": r.work_date,
			"clock_in_time": r.clock_in_time,
			"clock_out_time": r.clock_out_time,
			"clock_in_location": r.clock_in_location,
			"clock_out_location": r.clock_out_location,
			"status": r.status,
			"work_minutes": r.work_minutes,
			"note": r.note,
		}
		for r in records
	]
	return {"items": items}


def _parse_clock_value(value: str | None, work_day: date_type) -> datetime | None:
	"""'HH:MM' 또는 ISO datetime 문자열을 해당 근무일 기준 naive datetime으로 변환."""
	if value is None:
		return None
	s = str(value).strip()
	if not s:
		return None
	if "T" in s or len(s) > 8:
		try:
			dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
			if dt.tzinfo is not None:
				dt = dt.replace(tzinfo=None)
			return dt
		except ValueError:
			pass
	try:
		parts = s.split(":")
		h = int(parts[0])
		m = int(parts[1]) if len(parts) > 1 else 0
		sec = int(parts[2]) if len(parts) > 2 else 0
		return datetime.combine(work_day, time_type(h, m, sec))
	except (ValueError, IndexError):
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=f"시간 형식을 확인해 주세요. (HH:MM) 입력값: {value!r}",
		)


def _recompute_work_minutes(clock_in: datetime | None, clock_out: datetime | None) -> int:
	if not clock_in or not clock_out:
		return 0
	delta = clock_out - clock_in
	total_minutes = max(0, int(delta.total_seconds() // 60))
	# 점심시간(휴게시간) 1시간 자동 공제: 8시간(480분) 이상 체류 시
	if total_minutes >= 480:
		total_minutes = max(0, total_minutes - 60)
	return total_minutes


def update_attendance_record(
	db: Session,
	record_id: int,
	updates: dict,
) -> Attendance:
	"""attendance PK 기준 부분 수정 (관리자)."""
	record = db.query(Attendance).filter(Attendance.id == record_id).first()
	if not record:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="근태 기록을 찾을 수 없습니다.")

	work_day = record.work_date

	if "clock_in_time" in updates:
		raw_in = updates["clock_in_time"]
		if raw_in is None or (isinstance(raw_in, str) and not str(raw_in).strip()):
			record.clock_in_time = None
		else:
			record.clock_in_time = _parse_clock_value(str(raw_in), work_day)
	if "clock_out_time" in updates:
		raw_out = updates["clock_out_time"]
		if raw_out is None or (isinstance(raw_out, str) and not str(raw_out).strip()):
			record.clock_out_time = None
		else:
			record.clock_out_time = _parse_clock_value(str(raw_out), work_day)
	if "status" in updates and updates["status"] is not None:
		record.status = str(updates["status"]).strip() or record.status

	record.work_minutes = _recompute_work_minutes(record.clock_in_time, record.clock_out_time)

	db.add(record)
	db.commit()
	db.refresh(record)
	return record