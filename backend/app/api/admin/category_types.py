from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.session import get_db
from services.auth_service import get_current_admin
from services.admin import category_service as service
from schemas.hr import todos_schemas

router = APIRouter()

@router.post("/")
def create_category_type(payload: todos_schemas.CategoryTypeCreate, db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
    return service.add_category_type(db, payload)

@router.get("/")
def get_category_types(db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
    return service.get_all_category_types(db)

@router.patch("/{cat_id}")
def update_category(cat_id: int, cat_data: dict, db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
    return service.update_category_type(db, cat_id, cat_data)

@router.delete("/{cat_id}")
def delete_category(cat_id: int, db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
    return service.delete_category_type(db, cat_id)