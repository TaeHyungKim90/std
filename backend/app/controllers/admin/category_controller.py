from sqlalchemy.orm import Session
from services.admin import category_service as service

def create_todo_category_type(db: Session, payload):
    return service.add_category_type(db, payload)

def get_todo_category_types(db: Session):
    return service.get_all_category_types(db)

def update_category(db: Session, cat_id: int, cat_data: dict):
    return service.update_category_type(db, cat_id, cat_data)

def delete_category(db: Session, cat_id: int):
    return service.delete_category_type(db, cat_id)