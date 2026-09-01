from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.deps import tenant_id_from_user
from db.session import get_db
from services.auth_service import get_current_admin_for_tenant
from services.admin.system_mgmt_service import (
	create_position,
	delete_position,
	get_all_positions,
	update_position,
)
from schemas.system_schemas import PositionCreate, PositionResponse, PositionUpdate

router = APIRouter()


@router.get("/", response_model=list[PositionResponse])
def list_positions(
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return get_all_positions(db, tid)


@router.post("/", response_model=PositionResponse)
def create_pos(
	payload: PositionCreate,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return create_position(db, tid, payload)


@router.patch("/{position_id}", response_model=PositionResponse)
def patch_pos(
	position_id: int,
	payload: PositionUpdate,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return update_position(db, tid, position_id, payload)


@router.delete("/{position_id}")
def delete_pos(
	position_id: int,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return delete_position(db, tid, position_id)
