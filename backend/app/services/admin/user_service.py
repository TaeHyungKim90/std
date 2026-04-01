from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException
from models.auth_models import User, UserVacation
from models.hr_models import Todo
from constants.vacation_categories import VACATION_DEDUCTIBLE_CATEGORIES
from schemas.auth_schemas import UserCreate, UserUpdate
from services.auth_service import get_password_hash
from datetime import date, timedelta
from models.holiday_models import Holiday

# 1. 전체 사용자 목록 조회
def get_all_users(db: Session):
	return db.query(User).options(joinedload(User.vacation)).order_by(User.id.desc()).all()

# 2. 신규 사용자 등록 (관리자용)
def create_user_by_admin(db: Session, payload: UserCreate):
	existing_user = db.query(User).filter(User.user_login_id == payload.user_login_id).first()
	if existing_user:
		raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")

	hashed_pw = get_password_hash(payload.user_password)
	new_user = User(
		user_login_id=payload.user_login_id,
		user_password=hashed_pw,
		user_name=payload.user_name,
		user_nickname=payload.user_nickname,
		role=payload.role,
		join_date=payload.joined_at,
		resignation_date=payload.resignation_date
	)
	db.add(new_user)
	db.commit()
	db.refresh(new_user)
	return new_user

# 3. 사용자 정보 수정
def update_user_by_admin(db: Session, user_id: int, payload: UserUpdate):
	user = db.query(User).filter(User.id == user_id).first()
	if not user:
		raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

	update_data = payload.model_dump(exclude_unset=True)
	update_data.pop("user_login_id", None)
	if "joined_at" in update_data:
		update_data["join_date"] = update_data.pop("joined_at")
	for key, value in update_data.items():
		if key == "user_password":
			if value:
				setattr(user, key, get_password_hash(value))
		else:
			setattr(user, key, value)

	db.commit()
	db.refresh(user)
	return user

def delete_user_by_admin(db: Session, user_id: int):
	# 1. 대상 사용자 조회
	user = db.query(User).filter(User.id == user_id).first()
	if not user:
		raise HTTPException(status_code=404, detail="삭제하려는 사용자를 찾을 수 없습니다.")
	db.delete(user)
	db.commit()
	
	return {"status": "success", "message": f"사용자 '{user.user_login_id}'가 성공적으로 삭제되었습니다."}

def sync_all_users_vacation(db: Session):
	"""모든 재직자의 입사일을 기준으로 연차를 자동 정산하여 테이블에 저장합니다."""
	# 입사일이 있고, 퇴사하지 않은(재직중인) 유저만 가져옵니다.
	users = db.query(User).filter(
		User.join_date.isnot(None),
		User.resignation_date.is_(None)
	).all()
	
	today = date.today()
	user_login_ids = [u.user_login_id for u in users]

	# 성능 최적화: 사용자별 Todo를 한 번에 조회해서 메모리에서 그룹핑
	vacation_todos = (
		db.query(Todo)
		.filter(Todo.user_id.in_(user_login_ids))
		.filter(Todo.category.in_(VACATION_DEDUCTIBLE_CATEGORIES))
		.all()
	)
	todos_by_user: dict[str, list[Todo]] = {}
	global_start: date | None = None
	global_end: date | None = None
	for todo in vacation_todos:
		todos_by_user.setdefault(todo.user_id, []).append(todo)
		start_day = todo.start_date.date()
		end_day = (todo.end_date or todo.start_date).date()
		if global_start is None or start_day < global_start:
			global_start = start_day
		if global_end is None or end_day > global_end:
			global_end = end_day

	# 성능 최적화: 필요한 구간의 공휴일을 한 번만 조회
	holiday_dates: set[date] = set()
	if global_start is not None and global_end is not None:
		holiday_dates = {
			row[0]
			for row in db.query(Holiday.holiday_date).filter(
				Holiday.holiday_date >= global_start,
				Holiday.holiday_date <= global_end,
			).all()
		}
	updated_count = 0
	
	for user in users:
		join_date = user.join_date
		
		# 1. 근속 개월 수 및 연수 계산 (순수 파이썬 로직)
		months_diff = (today.year - join_date.year) * 12 + today.month - join_date.month
		if today.day < join_date.day:
			months_diff -= 1
		months_diff = max(months_diff, 0)
			
		years_worked = months_diff // 12
		
		# 2. 총 연차 계산 (근로기준법)
		total_vacation = 0
		if years_worked == 0:
			# 1년 미만: 1개월 만근마다 1일
			total_vacation = months_diff
		else:
			# 1년 이상: 기본 15일 + (근속연수-1)//2 만큼 가산 (최대 25일)
			bonus_days = (years_worked - 1) // 2
			total_vacation = min(15 + bonus_days, 25)
			
		# 3. DB 테이블 업데이트 (없으면 생성, 있으면 수정)
		vacation_record = db.query(UserVacation).filter(UserVacation.user_id == user.user_login_id).first()
		
		if not vacation_record:
			vacation_record = UserVacation(user_id=user.user_login_id, used_days=0.0)
			db.add(vacation_record)

		# 4. 사용 연차 재집계
		# - 연차(종일): 주말/공휴일 제외
		# - 반차: 0.5 고정
		recalculated_used_days = 0.0
		for todo in todos_by_user.get(user.user_login_id, []):
			if todo.category not in VACATION_DEDUCTIBLE_CATEGORIES:
				continue
			if todo.category == "vacation_full":
				start_day = todo.start_date.date()
				end_day = (todo.end_date or todo.start_date).date()
				if end_day < start_day:
					start_day, end_day = end_day, start_day
				current = start_day
				while current <= end_day:
					if current.weekday() < 5 and current not in holiday_dates:
						recalculated_used_days += 1.0
					current += timedelta(days=1)
			else:
				recalculated_used_days += 0.5
			
		vacation_record.total_days = total_vacation
		vacation_record.used_days = recalculated_used_days
		# 잔여 연차 = 총 연차 - 재집계 사용 연차
		vacation_record.remaining_days = max(total_vacation - recalculated_used_days, 0.0)
		
		updated_count += 1
		
	db.commit()
	return {"message": f"총 {updated_count}명의 연차 정산 및 테이블 저장이 완료되었습니다."}
