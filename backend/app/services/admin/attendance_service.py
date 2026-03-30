from datetime import datetime, date as date_type

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