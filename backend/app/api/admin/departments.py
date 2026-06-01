from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.deps import tenant_id_from_user
from db.session import get_db
from services.auth_service import get_current_admin_for_tenant
from services.admin.system_mgmt_service import (
	create_department,
	delete_department,
	get_all_departments,
	update_department,
)
from schemas.system_schemas import (
	DepartmentCreate,
	DepartmentResponse,
	DepartmentUpdate,
)

router = APIRouter()


@router.get("/", response_model=list[DepartmentResponse])
def list_departments(
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return get_all_departments(db, tid)


@router.post("/", response_model=DepartmentResponse)
def create_dept(
	payload: DepartmentCreate,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return create_department(db, tid, payload)


@router.patch("/{department_id}", response_model=DepartmentResponse)
def patch_dept(
	department_id: int,
	payload: DepartmentUpdate,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return update_department(db, tid, department_id, payload)


@router.delete("/{department_id}")
def delete_dept(
	department_id: int,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return delete_department(db, tid, department_id)
