from datetime import datetime, date as date_type, time as time_type, timedelta
from typing import Any, cast

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from constants.vacation_categories import (
	VACATION_TODO_CATEGORIES,
	VACATION_TODO_SKIPS_ABSENT_VIRTUAL,
)
from core.config import settings
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
			Attendance.clock_in_time.desc(),
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


_VACATION_LABELS: dict[str, str] = {
	"vacation_full": "연차",
	"vacation_am": "오전반차",
	"vacation_pm": "오후반차",
	"official_leave": "공가",
	"vacation_sick": "병가",
	"vacation_special": "경조휴가",
}


def _parse_hhmm_cfg(s: str) -> time_type:
	parts = s.strip().split(":")
	return time_type(int(parts[0]), int(parts[1]))


def _build_todos_by_date(start_d: date_type, end_d: date_type, todos: list[Todo]) -> dict[date_type, list[Todo]]:
	todos_by_date: dict[date_type, list[Todo]] = {}
	for t in todos:
		cur = max(start_d, t.start_date.date())
		last = min(end_d, (t.end_date or t.start_date).date())
		ud = cur
		while ud <= last:
			todos_by_date.setdefault(ud, []).append(t)
			ud += timedelta(days=1)
	return todos_by_date


def _vacation_summary_and_half_day(day_todos: list[Todo]) -> tuple[str | None, str | None]:
	cats = {t.category for t in day_todos if t.category}
	labels: list[str] = []
	order = (
		"vacation_full",
		"official_leave",
		"vacation_am",
		"vacation_pm",
		"vacation_sick",
		"vacation_special",
	)
	for key in order:
		if key in cats:
			labels.append(_VACATION_LABELS.get(key, key))
	half: str | None = None
	if "vacation_am" in cats and "vacation_pm" in cats:
		half = "both"
	elif "vacation_am" in cats:
		half = "am"
	elif "vacation_pm" in cats:
		half = "pm"
	return (", ".join(labels) if labels else None, half)


def _half_day_review_hint(half_day_type: str | None, record: Attendance | None) -> str | None:
	if half_day_type == "both":
		if record is None or record.clock_in_time is None:
			return "HALF_DAY_BOTH_NO_ATTENDANCE"
		return "HALF_DAY_BOTH_NEEDS_REVIEW"
	if half_day_type not in ("am", "pm") or record is None:
		return None
	if record.clock_in_time is None:
		return "HALF_DAY_NO_ATTENDANCE"
	le = _parse_hhmm_cfg(settings.ATTENDANCE_LUNCH_END)
	we = _parse_hhmm_cfg(settings.ATTENDANCE_WORKDAY_END)
	ls = _parse_hhmm_cfg(settings.ATTENDANCE_LUNCH_START)
	cit = record.clock_in_time.time()
	co = record.clock_out_time
	cot = co.time() if co else None
	if half_day_type == "am":
		if cit < le:
			return "HALF_DAY_NEEDS_REVIEW"
		if cot is None or cot > we:
			return "HALF_DAY_NEEDS_REVIEW"
		return "HALF_DAY_OK"
	if half_day_type == "pm":
		if cit >= ls:
			return "HALF_DAY_NEEDS_REVIEW"
		if cot is None:
			return "HALF_DAY_NEEDS_REVIEW"
		if cot > le:
			return "HALF_DAY_NEEDS_REVIEW"
		return "HALF_DAY_OK"
	return None


def _calendar_row_enrichment(
	work_date: date_type,
	day_todos: list[Todo],
	record: Attendance | None,
	holiday_name: str | None,
) -> dict[str, Any]:
	is_weekend = work_date.weekday() >= 5
	summary, half = _vacation_summary_and_half_day(day_todos)
	review = _half_day_review_hint(half, record)
	return {
		"vacation_todo_summary": summary,
		"half_day_type": half,
		"review_hint": review,
		"is_weekend": is_weekend,
		"is_public_holiday": holiday_name is not None,
		"holiday_name": holiday_name,
	}


def get_user_attendance_range(
	db: Session,
	user_login_id: str,
	start_date: str | None,
	end_date: str | None,
) -> dict:
	"""특정 직원의 근태 기록을 기간(포함)으로 조회.

	- Attendance 행에 일자별 휴가 To-Do 요약·반차 힌트 병기(update.md §0.3, §1)
	- 반차일 무기록 → MISSING_EXPLANATION 가상 행(자동 결근 확정 없음)
	- 연차·공가 일정일은 결근 가상행 생략; 병가·경조 등은 무기록 시 결근 가상행 유지
	"""
	start_d, end_d = _parse_range_dates(start_date, end_date)
	today = datetime.now().date()
	user = db.query(User).filter(User.user_login_id == user_login_id).first()
	if not user:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다.")

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
		db.query(Holiday.holiday_date, Holiday.holiday_name)
		.filter(Holiday.holiday_date >= start_d, Holiday.holiday_date <= end_d)
		.all()
	)
	holiday_by_date: dict[date_type, str] = {row[0]: row[1] for row in holiday_rows}
	holiday_dates = set(holiday_by_date.keys())

	vac_attendance_dates = {r.work_date for r in records if is_vacation_status(r.status)}
	day_start = datetime.combine(start_d, time_type.min)
	day_end = datetime.combine(end_d, time_type.max)
	vac_todos = (
		db.query(Todo)
		.filter(Todo.user_id == user_login_id)
		.filter(Todo.category.in_(VACATION_TODO_CATEGORIES))
		.filter(Todo.start_date <= day_end)
		.filter(or_(Todo.end_date.is_(None), Todo.end_date >= day_start))
		.all()
	)
	todos_by_date = _build_todos_by_date(start_d, end_d, vac_todos)

	items: list[dict[str, Any]] = []
	for r in records:
		d = cast(date_type, r.work_date)
		day_todos = todos_by_date.get(d, [])
		hname = holiday_by_date.get(d)
		ex = _calendar_row_enrichment(d, day_todos, r, hname)
		items.append(
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
				**ex,
			}
		)

	cur = start_d
	while cur <= end_d:
		if cur in record_by_day:
			cur += timedelta(days=1)
			continue
		is_weekend = cur.weekday() >= 5
		is_holiday = cur in holiday_dates
		day_todos = todos_by_date.get(cur, [])
		cats = {t.category for t in day_todos if t.category}
		hname = holiday_by_date.get(cur)

		if is_weekend or is_holiday:
			# 주말·공휴일에도 휴가 To-Do는 조회 행에 반영(update.md §1.5)
			if cats & VACATION_TODO_SKIPS_ABSENT_VIRTUAL:
				cur += timedelta(days=1)
				continue
			ex = _calendar_row_enrichment(cur, day_todos, None, hname)
			if "vacation_am" in cats or "vacation_pm" in cats:
				items.append(
					{
						"id": -(1_000_000_000 + int(cur.strftime("%Y%m%d"))),
						"user_id": user_login_id,
						"work_date": cur,
						"clock_in_time": None,
						"clock_out_time": None,
						"clock_in_location": None,
						"clock_out_location": None,
						"status": "MISSING_EXPLANATION",
						"work_minutes": 0,
						"note": "HALF_DAY_PENDING",
						**ex,
					}
				)
			elif {"vacation_sick", "vacation_special"} & cats:
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
						**ex,
					}
				)
			cur += timedelta(days=1)
			continue

		if cats & VACATION_TODO_SKIPS_ABSENT_VIRTUAL:
			cur += timedelta(days=1)
			continue

		ex = _calendar_row_enrichment(cur, day_todos, None, hname)
		if "vacation_am" in cats or "vacation_pm" in cats:
			items.append(
				{
					"id": -(1_000_000_000 + int(cur.strftime("%Y%m%d"))),
					"user_id": user_login_id,
					"work_date": cur,
					"clock_in_time": None,
					"clock_out_time": None,
					"clock_in_location": None,
					"clock_out_location": None,
					"status": "MISSING_EXPLANATION",
					"work_minutes": 0,
					"note": "HALF_DAY_PENDING",
					**ex,
				}
			)
		elif cur not in vac_attendance_dates:
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
					**ex,
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


def recompute_work_minutes_bulk(
	db: Session,
	start_date: str | None,
	end_date: str | None,
	*,
	user_login_id: str | None = None,
	dry_run: bool = True,
	max_change_samples: int = 200,
) -> dict:
	"""저장된 clock_in/out으로 work_minutes를 현재 공식으로 다시 계산해 반영(또는 dry_run으로 미리보기).

	- 출·퇴근 시각이 모두 있는 행만 대상
	- 잘못된 과거 계산식으로 저장된 데이터를 일괄 정정할 때 사용
	"""
	start_d, end_d = _parse_range_dates(start_date, end_date)
	q = (
		db.query(Attendance)
		.filter(
			Attendance.work_date >= start_d,
			Attendance.work_date <= end_d,
			Attendance.clock_in_time.isnot(None),
			Attendance.clock_out_time.isnot(None),
		)
	)
	if user_login_id:
		q = q.filter(Attendance.user_id == user_login_id.strip())

	records = q.order_by(Attendance.work_date.asc(), Attendance.id.asc()).all()
	examined = 0
	updated = 0
	unchanged = 0
	changes: list[dict] = []

	for rec in records:
		rec_any: Any = rec
		ci = rec_any.clock_in_time
		co = rec_any.clock_out_time
		new_m = _recompute_work_minutes(ci, co)
		old_m = int(rec_any.work_minutes or 0)
		examined += 1
		if new_m == old_m:
			unchanged += 1
			continue
		updated += 1
		if len(changes) < max_change_samples:
			changes.append(
				{
					"record_id": int(rec_any.id),
					"user_id": str(rec_any.user_id),
					"work_date": rec_any.work_date,
					"old_work_minutes": old_m,
					"new_work_minutes": new_m,
				}
			)
		if not dry_run:
			rec_any.work_minutes = new_m

	if not dry_run and updated > 0:
		db.commit()

	return {
		"dry_run": dry_run,
		"examined": examined,
		"updated": updated,
		"unchanged": unchanged,
		"changes": changes,
	}


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