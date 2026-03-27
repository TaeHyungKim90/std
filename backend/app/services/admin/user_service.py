from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException
from models.auth_models import User, UserVacation
from schemas.auth_schemas import UserCreate, UserUpdate
from services.auth_service import get_password_hash
from datetime import date

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
		join_date=payload.join_date,
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
	updated_count = 0
	
	for user in users:
		join_date = user.join_date
		
		# 1. 근속 개월 수 및 연수 계산 (순수 파이썬 로직)
		months_diff = (today.year - join_date.year) * 12 + today.month - join_date.month
		if today.day < join_date.day:
			months_diff -= 1
			
		years_worked = months_diff // 12
		months_worked = months_diff % 12
		
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
			
		vacation_record.total_days = total_vacation
		# 잔여 연차 = 총 연차 - 사용 연차
		vacation_record.remaining_days = total_vacation - vacation_record.used_days
		
		updated_count += 1
		
	db.commit()
	return {"message": f"총 {updated_count}명의 연차 정산 및 테이블 저장이 완료되었습니다."}
