from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from app.schemas.hr.todos_schemas import Todo, TodoCreate, TodoUpdate, TodoConfigBase
from app.controllers.hr import todos_controller
from app.services.auth_service import get_current_user

router = APIRouter()
# 토드 카테고리 관련
@router.get("/categories")
def read_categories(db: Session = Depends(get_db)):
    return todos_controller.get_categories(db)
# 토드 설정관련
@router.get("/config")
def read_todo_configs(db: Session = Depends(get_db),current_user: dict = Depends(get_current_user)):
    return todos_controller.get_todo_configs(db, current_user)

@router.put("/config")
def update_todo_config(config_in: TodoConfigBase, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return todos_controller.upsert_todo_config(db, current_user, config_in)
# 토드관련
@router.get("/", response_model=List[Todo])
def read_todos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return todos_controller.get_all_todos(db, skip, limit, current_user)

@router.post("/", response_model=Todo)
def create_todo(todo: TodoCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return todos_controller.create_new_todo(db, todo, current_user)

@router.patch("/{todo_id}", response_model=Todo)
def update_todo(todo_id: int, todo: TodoUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return todos_controller.update_existing_todo(db, todo_id,todo, current_user)

@router.delete("/{todo_id}", response_model=Todo)
def delete_todo(todo_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return todos_controller.delete_existing_todo(db, todo_id, current_user)
