from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from db.session import get_db
from services.auth_service import get_current_user
from services.hr import todos_service as service
from schemas.hr import todos_schemas

router = APIRouter()

# --- 카테고리 및 설정 ---
@router.get("/categories")
def read_categories(db: Session = Depends(get_db)):
    """등록된 모든 일정 카테고리를 조회합니다."""
    return service.get_categories(db)

@router.get("/config")
def read_todo_configs(db: Session = Depends(get_db),current_user: dict = Depends(get_current_user)):
    """유저의 일정 관리 개인 설정을 조회합니다."""
    user_id = current_user.get("userId")
    return service.get_todo_configs(db, user_id)

@router.put("/config")
def update_todo_config(config_in: todos_schemas.TodoConfigBase, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """유저의 일정 관리 개인 설정을 업데이트합니다."""
    user_id = current_user.get("userId")
    return service.upsert_todo_config(db, user_id, config_in)

# --- 할 일(Todo) 본체 ---
@router.get("/", response_model=List[todos_schemas.Todo])
def read_todos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """내 모든 일정을 조회합니다."""
    user_id = current_user.get("userId")
    return service.get_todos(db, user_id=user_id, skip=skip, limit=limit)

@router.post("/", response_model=todos_schemas.Todo)
def create_todo(todo: todos_schemas.TodoCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """새로운 일정을 생성합니다."""
    user_id = current_user.get("userId")
    return service.create_todo(db=db, todo=todo, user_id=user_id)

@router.patch("/{todo_id}", response_model=todos_schemas.Todo)
def update_todo(todo_id: int, todo: todos_schemas.TodoUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """일정을 수정합니다. (본인 소유 확인 포함)"""
    db_todo = service.update_todo(db, todo_id, todo, user_id=current_user.get("userId"))
    if not db_todo:
        raise HTTPException(status_code=403, detail="수정 권한이 없거나 해당 일정을 찾을 수 없습니다.")
    return db_todo

@router.delete("/{todo_id}")
def delete_todo(todo_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """일정을 삭제합니다. (본인 소유 확인 포함)"""
    db_todo = service.delete_todo(db, todo_id, user_id=current_user.get("userId"))
    if not db_todo:
        raise HTTPException(status_code=403, detail="삭제 권한이 없거나 해당 일정을 찾을 수 없습니다.")
    return {"success": True, "message": "삭제되었습니다."}