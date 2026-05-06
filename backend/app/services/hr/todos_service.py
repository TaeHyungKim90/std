from datetime import date, datetime
from typing import cast
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session, joinedload
from constants.vacation_categories import VACATION_DEDUCTIBLE_CATEGORIES
from models.hr_models import Todo, TodoConfig, TodoCategoryType
from models.auth_models import User
from schemas.hr.todos_schemas import TodoCreate, TodoUpdate, TodoConfigBase
from services.admin.user_service import (
	VacationUsageItem,
	calculate_user_vacation_snapshot,
	sync_user_vacation,
)
from fastapi import HTTPException

_SEOUL = ZoneInfo("Asia/Seoul")


def _to_seoul_date(dt: datetime | str) -> date:
	"""일정 시각을 서울 달력 날짜로 변환 (naive는 서울 현지 시각으로 간주)."""
	if isinstance(dt, str):
		normalized = dt.replace("Z", "+00:00")
		d2 = datetime.fromisoformat(normalized)
	else:
		d2 = dt
	if d2.tzinfo is None:
		d2 = d2.replace(tzinfo=_SEOUL)
	return d2.astimezone(_SEOUL).date()


def _assert_todo_range_within_employment(
	db: Session, user_id: str, start_date: datetime, end_date: datetime
) -> None:
	user = db.query(User).filter(User.user_login_id == user_id).first()
	if not user:
		return
	start_d = _to_seoul_date(start_date)
	end_d = _to_seoul_date(end_date)
	if end_d < start_d:
		start_d, end_d = end_d, start_d
	jd = user.join_date
	rd = user.resignation_date
	if jd is not None and start_d < jd:
		raise HTTPException(
			status_code=400, detail="입사일 이전 날짜에는 일정을 등록할 수 없습니다."
		)
	if jd is not None and end_d < jd:
		raise HTTPException(
			status_code=400, detail="입사일 이전 날짜에는 일정을 등록할 수 없습니다."
		)
	if rd is not None and start_d > rd:
		raise HTTPException(
			status_code=400, detail="퇴사일 이후 날짜에는 일정을 등록할 수 없습니다."
		)
	if rd is not None and end_d > rd:
		raise HTTPException(
			status_code=400, detail="퇴사일 이후 날짜에는 일정을 등록할 수 없습니다."
		)


def _get_user_for_vacation(db: Session, user_id: str) -> User:
	user = db.query(User).filter(User.user_login_id == user_id).first()
	if not user:
		raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
	return user


def _assert_vacation_balance(
	db: Session,
	user: User,
	*,
	extra_item: VacationUsageItem | None = None,
	exclude_todo_id: int | None = None,
) -> None:
	if extra_item is None or extra_item.category not in VACATION_DEDUCTIBLE_CATEGORIES:
		return
	snapshot = calculate_user_vacation_snapshot(
		db,
		user,
		extra_items=[extra_item],
		exclude_todo_id=exclude_todo_id,
	)
	if snapshot["used_days"] > snapshot["total_days"]:
		needed = snapshot["used_days"] - snapshot["total_days"]
		raise HTTPException(
			status_code=400,
			detail=f"잔여 연차가 부족합니다. (초과: {needed:g}일, 총 연차: {snapshot['total_days']:g}일)",
		)

# 모든 목록 조회 (캘린더)
# - 관리자: 전체 일정
# - 일반: 본인 일정 전체 
def get_todos(db: Session, skip: int = 0, limit: int = 100):
	q = db.query(Todo).options(joinedload(Todo.author))
	return q.offset(skip).limit(limit).all()

def create_todo(db: Session, todo: TodoCreate, user_id: str):
	end_for_range = todo.end_date if todo.end_date is not None else todo.start_date
	_assert_todo_range_within_employment(db, user_id, todo.start_date, end_for_range)
	user = _get_user_for_vacation(db, user_id)
	_assert_vacation_balance(
		db,
		user,
		extra_item=VacationUsageItem(todo.category, todo.start_date, todo.end_date),
	)

	todo_data = todo.model_dump(exclude={"user_id"}) 
	db_todo = Todo(**todo_data, user_id=user_id)
	
	try:
		db.add(db_todo)
		db.flush()
		sync_user_vacation(db, user)
		db.commit()
		db.refresh(db_todo)
		return db_todo
	except Exception as e:
		db.rollback()
		raise HTTPException(status_code=500, detail=f"일정 저장 중 오류 발생: {str(e)}")

def update_todo(db: Session, todo_id: int, todo_update: TodoUpdate, user_id: str):
	db_todo = db.query(Todo).filter(Todo.id == todo_id, Todo.user_id == user_id).first()
	if not db_todo:
		return None

	user = _get_user_for_vacation(db, user_id)
	new_category = todo_update.category if todo_update.category is not None else db_todo.category

	# 수정 요청에 날짜가 없으면 기존 날짜 사용 (ORM 컬럼은 Pyright에 Column[datetime]으로 잡혀 cast)
	new_start: datetime = (
		todo_update.start_date
		if todo_update.start_date is not None
		else cast(datetime, db_todo.start_date)
	)
	new_end: datetime | None = (
		todo_update.end_date
		if todo_update.end_date is not None
		else cast(datetime | None, db_todo.end_date)
	)
	end_for_range: datetime = new_end if new_end is not None else new_start
	_assert_todo_range_within_employment(db, user_id, new_start, end_for_range)
	_assert_vacation_balance(
		db,
		user,
		extra_item=VacationUsageItem(cast(str | None, new_category), new_start, new_end),
		exclude_todo_id=todo_id,
	)
		
	# 실제 DB 필드 업데이트
	update_data = todo_update.model_dump(exclude_unset=True)
	for key, value in update_data.items():
		setattr(db_todo, key, value)
		
	try:
		db.flush()
		sync_user_vacation(db, user)
		db.commit()
		db.refresh(db_todo)
		return db_todo
	except Exception as e:
		db.rollback()
		raise HTTPException(status_code=500, detail=f"수정 중 오류 발생: {str(e)}")

def delete_todo(db: Session, todo_id: int, user_id: str):
	db_todo = db.query(Todo).filter(Todo.id == todo_id, Todo.user_id == user_id).first()
	if not db_todo:
		return None

	user = _get_user_for_vacation(db, user_id)

	db.delete(db_todo)
	db.flush()
	sync_user_vacation(db, user)
	db.commit()
	return db_todo

# ... 하단의 get_categories, get_todo_configs, upsert_todo_config 함수들은 기존과 동일하게 유지해 주시면 됩니다.
def get_categories(db: Session):
	return db.query(TodoCategoryType).all()

def get_todo_configs(db: Session, user_id: str):
	return db.query(TodoConfig).filter(TodoConfig.user_id == user_id).all()

def upsert_todo_config(db: Session, user_id: str, config_in: TodoConfigBase):
	"""
	등록과 수정을 한 번에 처리 (Upsert)
	"""
	# 1. 기존 설정이 있는지 확인
	db_config = db.query(TodoConfig).filter(TodoConfig.user_id == user_id, TodoConfig.category_key == config_in.category_key).first()
	if db_config:
		# 2. 존재하면 수정 (Update)
		db_config.color = config_in.color
		db_config.default_description = config_in.default_description
	else:
		# 3. 존재하지 않으면 생성 (Create)
		db_config = TodoConfig(user_id=user_id, **config_in.model_dump())
		db.add(db_config)

	db.commit()
	db.refresh(db_config)