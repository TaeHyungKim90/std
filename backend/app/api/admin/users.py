from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from api.deps import tenant_id_from_user
from db.session import get_db
from services.auth_service import get_current_admin_for_tenant
from services.admin import user_service
from schemas.auth_schemas import UserResponse, UserCreate, UserUpdate

router = APIRouter()


@router.get("/", response_model=list[UserResponse])
def read_all_users(
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	"""[관리자] 전체 사용자 목록 (테단크 범위)."""
	return user_service.get_all_users(db, tenant_id_from_user(current_admin))


@router.post("/", response_model=UserResponse)
def create_user(
	payload: UserCreate,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	"""[관리자] 새 사용자 등록."""
	return user_service.create_user_by_admin(
		db, payload, tenant_id_from_user(current_admin)
	)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user_info(
	user_id: int,
	payload: UserUpdate,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	"""[관리자] 사용자 정보 수정."""
	return user_service.update_user_by_admin(
		db, user_id, payload, tenant_id_from_user(current_admin)
	)


@router.delete("/{user_id}")
def delete_user(
	user_id: int,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	"""[관리자] 사용자 삭제."""
	return user_service.delete_user_by_admin(
		db, user_id, tenant_id_from_user(current_admin)
	)


@router.post("/vacations/sync")
def sync_vacation(
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	"""[관리자] 연차 전체 동기화 (테단크 범위)."""
	return user_service.sync_all_users_vacation(db, tenant_id_from_user(current_admin))
