from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from db.session import get_db
from services.auth_service import get_current_admin
from services.admin import user_service
from schemas.auth_schemas import UserResponse, UserCreate, UserUpdate

# 마스터님 가이드대로 router 설정
router = APIRouter()

@router.get("/", response_model=list[UserResponse])
def read_all_users(db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
	"""[관리자] 전체 사용자 목록을 조회합니다."""
	return user_service.get_all_users(db)

@router.post("/", response_model=UserResponse)
def create_user(payload: UserCreate, db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
	"""[관리자] 새로운 사용자를 수동으로 등록합니다."""
	return user_service.create_user_by_admin(db, payload)

@router.patch("/{user_id}", response_model=UserResponse)
def update_user_info(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
	"""[관리자] 특정 사용자의 정보를 수정합니다."""
	return user_service.update_user_by_admin(db, user_id, payload)

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
	"""[관리자] 사용자를 삭제합니다."""
	return user_service.delete_user_by_admin(db, user_id)

@router.post("/vacations/sync")
def sync_vacation(db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
	"""[관리자] 입사일 기준 전 직원의 연차를 자동 정산(동기화)합니다."""
	return user_service.sync_all_users_vacation(db)