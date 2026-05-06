from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.system_schemas import (
	WorkLocationCreate,
	WorkLocationResponse,
	WorkLocationUpdate,
)
from services.admin.system_mgmt_service import (
	create_work_location,
	delete_work_location,
	get_all_work_locations,
	update_work_location,
)
from services.auth_service import get_current_admin

router = APIRouter()


@router.get("/", response_model=list[WorkLocationResponse])
def list_work_locations(
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin),
):
	return get_all_work_locations(db)


@router.post("/", response_model=WorkLocationResponse)
def create_work_location_api(
	payload: WorkLocationCreate,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin),
):
	return create_work_location(db, payload)


@router.patch("/{work_location_id}", response_model=WorkLocationResponse)
def patch_work_location(
	work_location_id: int,
	payload: WorkLocationUpdate,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin),
):
	return update_work_location(db, work_location_id, payload)


@router.delete("/{work_location_id}")
def delete_work_location_api(
	work_location_id: int,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin),
):
	return delete_work_location(db, work_location_id)
