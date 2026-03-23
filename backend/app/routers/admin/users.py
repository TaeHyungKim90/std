# app/routers/admin/users.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from controllers.admin import user_controller as controller
from db.session import get_db
from services.auth_service import get_current_admin
from schemas.auth_schemas import UserResponse, UserCreate, UserUpdate

router = APIRouter(tags=["Admin Users"])

@router.get("/", response_model=list[UserResponse])
def read_all_users(db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return controller.get_all_users(db)

@router.post("/", response_model=UserResponse)
def create_user(payload: UserCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return controller.register_user(db, payload)

@router.patch("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return controller.update_user_info(db, user_id, payload)

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return controller.delete_user(db, user_id)

@router.post("/vacations/sync")
def sync_vacation(db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return controller.sync_vacation(db)