from sqlalchemy.orm import Session
from app.services import admin_service
from app.schemas.auth_schemas import UserCreate, UserUpdate

def get_dashboard_statistics(db: Session):
    return admin_service.get_admin_stats(db)

def get_all_todo_list(db: Session):
    return admin_service.get_all_todos_with_author(db)

def delete_todo_by_admin(db: Session, todo_id: int,current_user: dict):    
    return admin_service.delete_todo_by_admin(db, todo_id)

def create_todo_category_type(db: Session, payload):
    return admin_service.add_category_type(db, payload)

def get_todo_category_types(db: Session):
    return admin_service.get_all_category_types(db)

def update_category(db: Session, cat_id: int, cat_data: dict):
    return admin_service.update_category_type(db, cat_id, cat_data)

def delete_category(db: Session, cat_id: int):
    return admin_service.delete_category_type(db, cat_id)

def get_all_attendance(db,user_name: str = None, work_date: str = None):
    return admin_service.get_all_attendance(db,user_name, work_date)

def get_all_users(db: Session):
    return admin_service.get_all_users(db)

def register_user(db: Session, payload: UserCreate):
    return admin_service.create_user_by_admin(db, payload)

def update_user_info(db: Session, user_id: int, payload: UserUpdate):
    return admin_service.update_user_by_admin(db, user_id, payload)

def delete_user(db: Session, user_id: int):    
    return admin_service.delete_user_by_admin(db, user_id)
    
def sync_vacation(db: Session):
    return admin_service.sync_all_users_vacation(db)