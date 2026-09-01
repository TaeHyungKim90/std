from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from api.deps import tenant_id_from_user
from db.session import get_db
from services.auth_service import get_current_user_for_tenant, require_user_login_id
from services.hr import todos_service as service
from schemas.hr import todos_schemas

router = APIRouter()


@router.get("/categories")
def read_categories(
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	return service.get_categories(db, tenant_id_from_user(current_user))


@router.get("/config")
def read_todo_configs(
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	user_id = require_user_login_id(current_user)
	return service.get_todo_configs(db, tenant_id_from_user(current_user), user_id)


@router.put("/config")
def update_todo_config(
	config_in: todos_schemas.TodoConfigBase,
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	user_id = require_user_login_id(current_user)
	return service.upsert_todo_config(db, tenant_id_from_user(current_user), user_id, config_in)


@router.get("/", response_model=List[todos_schemas.Todo])
def read_todos(
	skip: int = 0,
	limit: int = 100,
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	tid = tenant_id_from_user(current_user)
	return service.get_todos(db, tid, skip=skip, limit=limit)


@router.post("/", response_model=todos_schemas.Todo)
def create_todo(
	todo: todos_schemas.TodoCreate,
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	tid = tenant_id_from_user(current_user)
	user_id = require_user_login_id(current_user)
	return service.create_todo(db=db, tenant_id=tid, todo=todo, user_id=user_id)


@router.patch("/{todo_id}", response_model=todos_schemas.Todo)
def update_todo(
	todo_id: int,
	todo: todos_schemas.TodoUpdate,
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	tid = tenant_id_from_user(current_user)
	user_id = require_user_login_id(current_user)
	db_todo = service.update_todo(db, tid, todo_id, todo, user_id=user_id)
	if not db_todo:
		raise HTTPException(status_code=403, detail="본인 일정만 수정할 수 있습니다.")
	return db_todo


@router.delete("/{todo_id}")
def delete_todo(
	todo_id: int,
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	tid = tenant_id_from_user(current_user)
	user_id = require_user_login_id(current_user)
	db_todo = service.delete_todo(db, tid, todo_id, user_id=user_id)
	if not db_todo:
		raise HTTPException(status_code=403, detail="본인 일정만 수정할 수 있습니다.")
	return {"success": True, "message": "일정이 삭제되었습니다."}
