from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import cast

from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException
from models.auth_models import User, UserAvatarSetting, UserVacation
from models.system_models import Department, Position
from models.hr_models import Todo
from constants.bootstrap_admin import is_bootstrap_system_admin
from constants.vacation_categories import VACATION_DEDUCTIBLE_CATEGORIES
from schemas.auth_schemas import UserCreate, UserUpdate
from services.auth_service import get_password_hash
from services.tenant_scope import (
	directory_users_in_tenant,
	holidays_in_tenant,
	todos_in_tenant,
	user_vacations_in_tenant,
)
from models.holiday_models import Holiday
from utils.seoul_time import today_seoul


@dataclass(frozen=True)
class VacationUsageItem:
	category: str | None
	start_date: datetime
	end_date: datetime | None = None

def refresh_active_users_vacation(db: Session, users: list[User], today: date | None = None) -> None:
	"""재직자 연차를 입사일·휴가 일정 기준으로 일괄 재정산합니다."""
	today = today or today_seoul()
	for user in users:
		if user.join_date is None or user.resignation_date is not None:
			continue
		sync_user_vacation(db, user, today)


# 1. 전체 사용자 목록 조회
def get_all_users(db: Session, tenant_id: int):
	users = (
		directory_users_in_tenant(db, tenant_id)
		.options(
			joinedload(User.vacation),
			joinedload(User.avatar_setting),
			joinedload(User.department),
			joinedload(User.position),
		)
		.order_by(User.id.desc())
		.all()
	)
	refresh_active_users_vacation(db, users)
	db.commit()
	for user in users:
		db.refresh(user)
	return users


def _resolve_department_position(
	db: Session, payload, tenant_id: int
) -> tuple[int | None, int | None]:
	department_id = getattr(payload, "department_id", None)
	position_id = getattr(payload, "position_id", None)

	if department_id is not None:
		department = (
			db.query(Department)
			.filter(Department.id == department_id, Department.tenant_id == tenant_id)
			.first()
		)
		if not department:
			raise HTTPException(status_code=400, detail="유효하지 않은 부서입니다.")

	if position_id is not None:
		position = (
			db.query(Position)
			.filter(Position.id == position_id, Position.tenant_id == tenant_id)
			.first()
		)
		if not position:
			raise HTTPException(status_code=400, detail="유효하지 않은 직급입니다.")

	return department_id, position_id


def _completed_work_months(join_date: date, today: date) -> int:
	"""입사일 기준 완료된 근속 개월 수(입사 당일=0, 다음 달 같은 일자에 1개월 완료)."""
	if today < join_date:
		return 0
	months = (today.year - join_date.year) * 12 + today.month - join_date.month
	if today.day < join_date.day:
		months -= 1
	return max(months, 0)


def _calculate_total_vacation(join_date: date, today: date) -> int:
	"""총 발생 연차: 1년 미만=월차(완료 개월 수), 1년 이상=15일+2년마다 1일 가산(최대 25)."""
	months_diff = _completed_work_months(join_date, today)
	years_worked = months_diff // 12
	if years_worked == 0:
		return months_diff
	bonus_days = (years_worked - 1) // 2
	return min(15 + bonus_days, 25)


def _todo_to_vacation_usage_item(todo: Todo) -> VacationUsageItem:
	return VacationUsageItem(
		category=cast(str | None, todo.category),
		start_date=cast(datetime, todo.start_date),
		end_date=cast(datetime | None, todo.end_date),
	)


def _get_holiday_dates(db: Session, tenant_id: int, items: list[VacationUsageItem]) -> set[date]:
	global_start: date | None = None
	global_end: date | None = None
	for item in items:
		start_day = item.start_date.date()
		end_day = (item.end_date or item.start_date).date()
		if end_day < start_day:
			start_day, end_day = end_day, start_day
		if global_start is None or start_day < global_start:
			global_start = start_day
		if global_end is None or end_day > global_end:
			global_end = end_day

	if global_start is None or global_end is None:
		return set()
	return {
		row[0]
		for row in holidays_in_tenant(db, tenant_id)
		.filter(Holiday.holiday_date >= global_start, Holiday.holiday_date <= global_end)
		.with_entities(Holiday.holiday_date)
		.all()
	}


def _calculate_used_vacation_days(items: list[VacationUsageItem], holiday_dates: set[date]) -> float:
	recalculated_used_days = 0.0
	for item in items:
		if item.category not in VACATION_DEDUCTIBLE_CATEGORIES:
			continue
		if item.category == "vacation_full":
			start_day = item.start_date.date()
			end_day = (item.end_date or item.start_date).date()
			if end_day < start_day:
				start_day, end_day = end_day, start_day
			current = start_day
			while current <= end_day:
				if current.weekday() < 5 and current not in holiday_dates:
					recalculated_used_days += 1.0
				current += timedelta(days=1)
		else:
			recalculated_used_days += 0.5
	return recalculated_used_days


def calculate_user_vacation_snapshot(
	db: Session,
	user: User,
	today: date | None = None,
	*,
	extra_items: list[VacationUsageItem] | None = None,
	exclude_todo_id: int | None = None,
) -> dict[str, float]:
	"""저장 전 검증과 저장 후 정산이 공유하는 사용자 연차 계산 스냅샷."""
	if user.join_date is None or user.resignation_date is not None:
		return {"total_days": 0.0, "used_days": 0.0, "remaining_days": 0.0}

	today = today or today_seoul()
	tenant_id = cast(int, user.tenant_id)
	query = (
		todos_in_tenant(db, tenant_id)
		.filter(Todo.user_id == user.user_login_id)
		.filter(Todo.category.in_(VACATION_DEDUCTIBLE_CATEGORIES))
	)
	if exclude_todo_id is not None:
		query = query.filter(Todo.id != exclude_todo_id)
	items = [_todo_to_vacation_usage_item(todo) for todo in query.all()]
	if extra_items:
		items.extend(extra_items)

	holiday_dates = _get_holiday_dates(db, tenant_id, items)
	total_vacation = _calculate_total_vacation(cast(date, user.join_date), today)
	used_days = _calculate_used_vacation_days(items, holiday_dates)
	return {
		"total_days": float(total_vacation),
		"used_days": used_days,
		"remaining_days": max(total_vacation - used_days, 0.0),
	}


def sync_user_vacation(db: Session, user: User, today: date | None = None) -> UserVacation | None:
	"""사용자 1명의 입사일과 휴가 일정 기준으로 연차를 재정산합니다."""
	tid = cast(int, user.tenant_id)
	if user.join_date is None or user.resignation_date is not None:
		vacation_record = (
			user_vacations_in_tenant(db, tid)
			.filter(UserVacation.user_id == user.user_login_id)
			.first()
		)
		if vacation_record and user.join_date is None:
			vacation_record.total_days = 0
			vacation_record.remaining_days = 0.0
			return vacation_record
		return None

	snapshot = calculate_user_vacation_snapshot(db, user, today)

	vacation_record = (
		user_vacations_in_tenant(db, tid)
		.filter(UserVacation.user_id == user.user_login_id)
		.first()
	)
	if not vacation_record:
		vacation_record = UserVacation(
			tenant_id=tid, user_id=user.user_login_id, used_days=0.0
		)
		db.add(vacation_record)

	vacation_record.total_days = int(snapshot["total_days"])
	vacation_record.used_days = snapshot["used_days"]
	vacation_record.remaining_days = snapshot["remaining_days"]
	return vacation_record

# 2. 신규 사용자 등록 (관리자용)
def create_user_by_admin(db: Session, payload: UserCreate, tenant_id: int):
	existing_user = (
		db.query(User)
		.filter(User.user_login_id == payload.user_login_id, User.tenant_id == tenant_id)
		.first()
	)
	if existing_user:
		raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")

	hashed_pw = get_password_hash(payload.user_password)
	department_id, position_id = _resolve_department_position(db, payload, tenant_id)
	new_user = User(
		tenant_id=tenant_id,
		user_login_id=payload.user_login_id,
		user_password=hashed_pw,
		user_name=payload.user_name,
		user_nickname=payload.user_nickname,
		user_profile_image_url=payload.user_profile_image_url,
		department_id=department_id,
		position_id=position_id,
		salary_bank_name=payload.salary_bank_name,
		salary_account_number=payload.salary_account_number,
		role=payload.role,
		join_date=payload.joined_at,
		resignation_date=payload.resignation_date
	)
	db.add(new_user)
	db.commit()
	db.refresh(new_user)
	if payload.joined_at is not None:
		sync_user_vacation(db, new_user)
		db.commit()
		db.refresh(new_user)
	if payload.avatar_zoom is not None or payload.avatar_offset_x is not None or payload.avatar_offset_y is not None:
		setting = UserAvatarSetting(
			user_id=new_user.id,
			zoom=payload.avatar_zoom if payload.avatar_zoom is not None else 1.0,
			offset_x=payload.avatar_offset_x if payload.avatar_offset_x is not None else 0.0,
			offset_y=payload.avatar_offset_y if payload.avatar_offset_y is not None else 0.0,
		)
		db.add(setting)
		db.commit()
		db.refresh(new_user)
	return new_user

# 3. 사용자 정보 수정
def update_user_by_admin(db: Session, user_id: int, payload: UserUpdate, tenant_id: int):
	user = db.query(User).filter(User.id == user_id, User.tenant_id == tenant_id).first()
	if not user:
		raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

	update_data = payload.model_dump(exclude_unset=True)
	update_data.pop("user_login_id", None)
	avatar_zoom = update_data.pop("avatar_zoom", None)
	avatar_offset_x = update_data.pop("avatar_offset_x", None)
	avatar_offset_y = update_data.pop("avatar_offset_y", None)
	department_id = update_data.pop("department_id", None)
	position_id = update_data.pop("position_id", None)
	if "joined_at" in update_data:
		update_data["join_date"] = update_data.pop("joined_at")
	if is_bootstrap_system_admin(user) and (
		"join_date" in update_data or "joined_at" in payload.model_fields_set
	):
		raise HTTPException(
			status_code=400,
			detail="테넌트 운영용 admin 계정은 입사일을 변경할 수 없습니다.",
		)
	for key, value in update_data.items():
		if key == "user_password":
			if value:
				setattr(user, key, get_password_hash(value))
		else:
			setattr(user, key, value)

	if "department_id" in payload.model_fields_set:
		if department_id is None:
			user.department_id = None
		else:
			department = (
				db.query(Department)
				.filter(Department.id == department_id, Department.tenant_id == tenant_id)
				.first()
			)
			if not department:
				raise HTTPException(status_code=400, detail="유효하지 않은 부서입니다.")
			user.department_id = department_id

	if "position_id" in payload.model_fields_set:
		if position_id is None:
			user.position_id = None
		else:
			position = (
				db.query(Position)
				.filter(Position.id == position_id, Position.tenant_id == tenant_id)
				.first()
			)
			if not position:
				raise HTTPException(status_code=400, detail="유효하지 않은 직급입니다.")
			user.position_id = position_id

	if avatar_zoom is not None or avatar_offset_x is not None or avatar_offset_y is not None:
		setting = db.query(UserAvatarSetting).filter(UserAvatarSetting.user_id == user.id).first()
		if not setting:
			setting = UserAvatarSetting(user_id=user.id)
			db.add(setting)
		if avatar_zoom is not None:
			setting.zoom = avatar_zoom
		if avatar_offset_x is not None:
			setting.offset_x = avatar_offset_x
		if avatar_offset_y is not None:
			setting.offset_y = avatar_offset_y

	if "join_date" in update_data or "joined_at" in payload.model_fields_set:
		sync_user_vacation(db, user)

	db.commit()
	updated_user = (
		db.query(User)
		.options(
			joinedload(User.vacation),
			joinedload(User.avatar_setting),
			joinedload(User.department),
			joinedload(User.position),
		)
		.filter(User.id == user_id)
		.first()
	)
	return updated_user or user

def delete_user_by_admin(db: Session, user_id: int, tenant_id: int):
	# 1. 대상 사용자 조회
	user = db.query(User).filter(User.id == user_id, User.tenant_id == tenant_id).first()
	if not user:
		raise HTTPException(status_code=404, detail="삭제하려는 사용자를 찾을 수 없습니다.")
	db.delete(user)
	db.commit()
	
	return {"status": "success", "message": f"사용자 '{user.user_login_id}'가 성공적으로 삭제되었습니다."}

def sync_all_users_vacation(db: Session, tenant_id: int):
	"""모든 재직자의 입사일을 기준으로 연차를 자동 정산하여 테이블에 저장합니다."""
	# 입사일이 있고, 퇴사하지 않은(재직중인) 유저만 가져옵니다.
	users = (
		directory_users_in_tenant(db, tenant_id)
		.filter(User.join_date.isnot(None), User.resignation_date.is_(None))
		.all()
	)
	
	today = today_seoul()
	user_login_ids = [u.user_login_id for u in users]

	# 성능 최적화: 사용자별 Todo를 한 번에 조회해서 메모리에서 그룹핑
	vacation_todos = (
		todos_in_tenant(db, tenant_id)
		.filter(Todo.user_id.in_(user_login_ids))
		.filter(Todo.category.in_(VACATION_DEDUCTIBLE_CATEGORIES))
		.all()
	)
	items_by_user: dict[str, list[VacationUsageItem]] = {}
	global_start: date | None = None
	global_end: date | None = None
	for todo in vacation_todos:
		item = _todo_to_vacation_usage_item(todo)
		items_by_user.setdefault(cast(str, todo.user_id), []).append(item)
		start_day = item.start_date.date()
		end_day = (item.end_date or item.start_date).date()
		if global_start is None or start_day < global_start:
			global_start = start_day
		if global_end is None or end_day > global_end:
			global_end = end_day

	# 성능 최적화: 필요한 구간의 공휴일을 한 번만 조회
	holiday_dates: set[date] = set()
	if global_start is not None and global_end is not None:
		holiday_dates = {
			row[0]
			for row in holidays_in_tenant(db, tenant_id)
			.filter(Holiday.holiday_date >= global_start, Holiday.holiday_date <= global_end)
			.with_entities(Holiday.holiday_date)
			.all()
		}
	updated_count = 0
	
	for user in users:
		join_date = user.join_date
		
		total_vacation = _calculate_total_vacation(cast(date, join_date), today)
			
		# 3. DB 테이블 업데이트 (없으면 생성, 있으면 수정)
		vacation_record = (
			user_vacations_in_tenant(db, tenant_id)
			.filter(UserVacation.user_id == user.user_login_id)
			.first()
		)

		if not vacation_record:
			vacation_record = UserVacation(
				tenant_id=tenant_id, user_id=user.user_login_id, used_days=0.0
			)
			db.add(vacation_record)

		recalculated_used_days = _calculate_used_vacation_days(
			items_by_user.get(cast(str, user.user_login_id), []),
			holiday_dates,
		)
			
		vacation_record.total_days = total_vacation
		vacation_record.used_days = recalculated_used_days
		# 잔여 연차 = 총 연차 - 재집계 사용 연차
		vacation_record.remaining_days = max(total_vacation - recalculated_used_days, 0.0)
		
		updated_count += 1
		
	db.commit()
	return {"message": f"총 {updated_count}명의 연차 정산 및 테이블 저장이 완료되었습니다."}
