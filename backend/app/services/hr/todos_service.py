from datetime import datetime
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from constants.vacation_categories import VACATION_DEDUCTIBLE_CATEGORIES
from models.hr_models import Todo, TodoConfig, TodoCategoryType
from models.auth_models import UserVacation
from schemas.hr.todos_schemas import TodoCreate, TodoUpdate, TodoConfigBase
from fastapi import HTTPException

# todo_category_type.category_key 및 Todo.category와 동일 (주간보고 = 비공개, 타인 열람 제한)
_WEEKLY_CATEGORY_KEY = "weekly"

# --- 헬퍼 함수: 카테고리 + 날짜 기간에 따른 연차 차감 일수 계산 ---
def get_deduct_days(category_key: str, start_date=None, end_date=None) -> float:
	"""카테고리 키와 날짜 기간에 따라 차감할 연차 일수를 정확히 계산합니다."""
	if category_key not in VACATION_DEDUCTIBLE_CATEGORIES:
		return 0.0

	# 날짜가 명확하지 않을 때의 기본값
	if not start_date or not end_date:
		return 0.5 if category_key in ("vacation_am", "vacation_pm") else 1.0

	# 문자열로 들어올 경우를 대비한 방어 코드 (ISO 포맷 파싱)
	if isinstance(start_date, str):
		start_date = datetime.fromisoformat(start_date.replace("Z", ""))
	if isinstance(end_date, str):
		end_date = datetime.fromisoformat(end_date.replace("Z", ""))

	# 날짜 차이 계산 (예: 1일~3일 이면 3일 차감)
	days = (end_date.date() - start_date.date()).days + 1
	if days < 1: 
		days = 1

	if category_key == "vacation_full":
		return float(days)
	else:
		# 반차는 기간이 늘어나도 0.5일 고정 (프론트에서도 막지만 백엔드 이중 방어)
		return 0.5

# 모든 목록 조회 (캘린더)
# - 관리자: 전체 일정
# - 일반: 본인 일정 전체 + 타인의 weekly(주간보고) 제외 일정
def get_todos(db: Session, user_id: str, skip: int = 0, limit: int = 100, is_admin: bool = False):
	q = db.query(Todo).options(joinedload(Todo.author))
	if is_admin:
		return q.offset(skip).limit(limit).all()
	return q.filter(
		or_(
			Todo.user_id == user_id,
			or_(Todo.category.is_(None), Todo.category != _WEEKLY_CATEGORY_KEY),
		)
	).offset(skip).limit(limit).all()

def create_todo(db: Session, todo: TodoCreate, user_id: str):
	# 🌟 수정됨: 기간을 계산하여 연차 차감
	deduct_days = get_deduct_days(todo.category, todo.start_date, todo.end_date)
	
	if deduct_days > 0:
		vacation = db.query(UserVacation).filter(UserVacation.user_id == user_id).first()
		if not vacation:
			raise HTTPException(status_code=400, detail="연차 정산 데이터가 없습니다. 관리자에게 문의하세요.")
		
		if vacation.remaining_days < deduct_days:
			raise HTTPException(status_code=400, detail=f"잔여 연차가 부족합니다. (필요: {deduct_days}일, 현재: {vacation.remaining_days}일)")
			
		vacation.used_days += deduct_days
		vacation.remaining_days -= deduct_days

	todo_data = todo.model_dump(exclude={"user_id"}) 
	db_todo = Todo(**todo_data, user_id=user_id)
	
	try:
		db.add(db_todo)
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
		
	old_category = db_todo.category
	new_category = todo_update.category if todo_update.category is not None else old_category
	
	# 🌟 핵심 수정: 기존 차감일수와 변경될 차감일수를 각각 계산
	old_deduct = get_deduct_days(old_category, db_todo.start_date, db_todo.end_date)
	
	# 수정 요청에 날짜가 없으면 기존 날짜 사용
	new_start = todo_update.start_date if todo_update.start_date is not None else db_todo.start_date
	new_end = todo_update.end_date if todo_update.end_date is not None else db_todo.end_date
	new_deduct = get_deduct_days(new_category, new_start, new_end)

	# 카테고리가 바뀌었거나, '일수' 자체가 달라졌을 때 재정산 실행!
	if old_category != new_category or old_deduct != new_deduct:
		vacation = db.query(UserVacation).filter(UserVacation.user_id == user_id).first()
		if not vacation:
			raise HTTPException(status_code=400, detail="연차 정산 데이터가 없습니다.")
		
		# (A) 기존에 차감됐던 분량 원상복구 (환불)
		if old_deduct > 0:
			vacation.used_days -= old_deduct
			vacation.remaining_days += old_deduct
			
		# (B) 새로운 일수 기준으로 재차감
		if new_deduct > 0:
			if vacation.remaining_days < new_deduct:
				# 잔여 연차 부족 시 롤백 (원상복구했던 거 다시 되돌림)
				vacation.used_days += old_deduct
				vacation.remaining_days -= old_deduct
				raise HTTPException(status_code=400, detail=f"잔여 연차가 부족하여 연장할 수 없습니다. (필요: {new_deduct}일)")
			
			vacation.used_days += new_deduct
			vacation.remaining_days -= new_deduct

		if vacation.used_days < 0: vacation.used_days = 0.0
		vacation.remaining_days = vacation.total_days - vacation.used_days
		
	# 실제 DB 필드 업데이트
	update_data = todo_update.model_dump(exclude_unset=True)
	for key, value in update_data.items():
		setattr(db_todo, key, value)
		
	try:
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

	# 🌟 수정됨: 삭제 시에도 정확한 기간을 계산하여 전액 환불
	refund_days = get_deduct_days(db_todo.category, db_todo.start_date, db_todo.end_date)
	
	if refund_days > 0:
		vacation = db.query(UserVacation).filter(UserVacation.user_id == user_id).first()
		if vacation:
			vacation.used_days -= refund_days
			vacation.remaining_days += refund_days
			if vacation.used_days < 0: vacation.used_days = 0.0

	db.delete(db_todo)
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
	return db_config