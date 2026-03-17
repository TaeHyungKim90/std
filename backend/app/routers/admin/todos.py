# app/routers/admin/todos.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.controllers.admin import todo_controller as controller
from database import get_db
from app.services.auth_service import get_current_admin

router = APIRouter(tags=["Admin Todos"])

@router.get("/")
def read_all_todos(db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return controller.get_all_todo_list(db)

@router.delete("/{todo_id}")
def delete_todo_by_admin(todo_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return controller.delete_todo_by_admin(db, todo_id)