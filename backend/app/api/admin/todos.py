from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from api.deps import tenant_id_from_user
from db.session import get_db
from services.auth_service import get_current_admin_for_tenant
from services.admin import todos_service
from schemas.hr import todos_schemas

router = APIRouter()


@router.get("/")
def read_all_todos(
	skip: int = Query(0, ge=0),
	limit: int = Query(20, ge=1, le=100),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	items = todos_service.get_all_todos_with_author(db, tid, skip=skip, limit=limit)
	total = todos_service.count_all_todos(db, tid)
	return {"items": items, "total": total}


@router.delete("/{todo_id}")
def delete_todo_by_admin(
	todo_id: int,
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return todos_service.delete_todo_by_admin(db, tid, todo_id)


@router.get("/vacations/for-date", response_model=list[todos_schemas.Todo])
def get_vacation_todos_for_date(
	work_date: str = Query(..., description="조회 기준일 (YYYY-MM-DD)"),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin_for_tenant),
):
	tid = tenant_id_from_user(current_admin)
	return todos_service.get_vacation_todos_for_date(db, tid, work_date)
