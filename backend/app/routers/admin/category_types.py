# app/routers/admin/category_types.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from controllers.admin import category_controller as controller
from db.session import get_db
from services.auth_service import get_current_admin
from schemas.hr import todos_schemas

router = APIRouter(tags=["Admin Categories"])

@router.post("/")
def create_category_type(payload: todos_schemas.CategoryTypeCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return controller.create_todo_category_type(db, payload)

@router.get("/")
def get_category_types(db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return controller.get_todo_category_types(db)

@router.patch("/{cat_id}")
def update_category(cat_id: int, cat_data: dict, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return controller.update_category(db, cat_id, cat_data)

@router.delete("/{cat_id}")
def delete_category(cat_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return controller.delete_category(db, cat_id)