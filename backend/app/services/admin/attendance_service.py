from datetime import datetime, date as date_type, time as time_type, timedelta
from typing import Any, cast

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from constants.vacation_categories import VACATION_TODO_CATEGORIES
from models.hr_models import Attendance
from models.auth_models import User
from models.holiday_models import Holiday
from models.hr_models import Todo
from services.hr.attendance_service import is_vacation_status

def get_all_attendance(
	db: Session,
	user_name: str | None = None,
	work_date: str | None = None,
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
	"""특정 직원의 근태 기록을 기간(포함)으로 조회.

	- 기존 Attendance가 있으면 해당 값을 우선 반환
	- Attendance가 없는 평일(휴일/공휴일 제외)에는 ABSENT 가상 행을 생성
	- 입사 전/퇴사 후 날짜는 제외
	"""
	start_d, end_d = _parse_range_dates(start_date, end_date)
	today = datetime.now().date()
	user = db.query(User).filter(User.user_login_id == user_login_id).first()
	if not user:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다.")

	# 입사/퇴사일 기준으로 조회 구간을 재정렬
	join_date = cast(date_type | None, user.join_date)
	resignation_date = cast(date_type | None, user.resignation_date)
	if join_date is not None and start_d < join_date:
		start_d = join_date
	if resignation_date is not None and end_d > resignation_date:
		end_d = resignation_date
	if end_d > today:
		end_d = today
	if start_d > end_d:
		return {"items": []}

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
	record_by_day = {r.work_date: r for r in records}

	holiday_rows = (
		db.query(Holiday.holiday_date)
		.filter(Holiday.holiday_date >= start_d, Holiday.holiday_date <= end_d)
		.all()
	)
	holiday_dates = {row[0] for row in holiday_rows}

	vac_attendance_dates = {r.work_date for r in records if is_vacation_status(r.status)}
	day_start = datetime.combine(start_d, time_type.min)
	day_end = datetime.combine(end_d, time_type.max)
	vac_todo_rows = (
		db.query(Todo.start_date, Todo.end_date)
		.filter(Todo.user_id == user_login_id)
		.filter(Todo.category.in_(VACATION_TODO_CATEGORIES))
		.filter(Todo.start_date <= day_end)
		.filter(or_(Todo.end_date.is_(None), Todo.end_date >= day_start))
		.all()
	)

	vac_todo_dates: set[date_type] = set()
	for sdt, edt in vac_todo_rows:
		cur = max(start_d, sdt.date())
		last = min(end_d, (edt or sdt).date())
		while cur <= last:
			vac_todo_dates.add(cur)
			cur += timedelta(days=1)

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

	cur = start_d
	while cur <= end_d:
		# 주말/공휴일/휴가일은 결근 가상행 생성 제외
		is_weekend = cur.weekday() >= 5
		if (
			not is_weekend
			and cur not in holiday_dates
			and cur not in vac_attendance_dates
			and cur not in vac_todo_dates
			and cur not in record_by_day
		):
			items.append(
				{
					"id": -int(cur.strftime("%Y%m%d")),
					"user_id": user_login_id,
					"work_date": cur,
					"clock_in_time": None,
					"clock_out_time": None,
					"clock_in_location": None,
					"clock_out_location": None,
					"status": "ABSENT",
					"work_minutes": 0,
					"note": "AUTO_ABSENT",
				}
			)
		cur += timedelta(days=1)

	items.sort(key=lambda x: (x["work_date"], x["id"]))
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

	# Column[...] 인스턴스 필드 대입·인자 전달 오탐 방지 (이 함수 범위만 Any)
	rec: Any = record
	work_day = cast(date_type, rec.work_date)

	if "clock_in_time" in updates:
		raw_in = updates["clock_in_time"]
		if raw_in is None or (isinstance(raw_in, str) and not str(raw_in).strip()):
			rec.clock_in_time = None
		else:
			rec.clock_in_time = _parse_clock_value(str(raw_in), work_day)
	if "clock_out_time" in updates:
		raw_out = updates["clock_out_time"]
		if raw_out is None or (isinstance(raw_out, str) and not str(raw_out).strip()):
			rec.clock_out_time = None
		else:
			rec.clock_out_time = _parse_clock_value(str(raw_out), work_day)
	if "status" in updates and updates["status"] is not None:
		rec.status = str(updates["status"]).strip() or rec.status

	rec.work_minutes = _recompute_work_minutes(rec.clock_in_time, rec.clock_out_time)

	db.add(rec)
	db.commit()
	db.refresh(rec)
	return rec