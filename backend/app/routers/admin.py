from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.controllers import admin_controller,holiday_controller
from database import get_db
from typing import Optional, List
from app.services.auth_service import get_current_admin,get_current_user # 기존 인증 함수 사용
from app.schemas.hr import todos_schemas
from app.schemas.auth_schemas import UserResponse,UserCreate,UserUpdate
from app.schemas.holiday_schemas import HolidayCreate,HolidayOut
router = APIRouter(tags=["Admin"])

@router.get("/stats")
def read_stats(db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return admin_controller.get_dashboard_statistics(db)

@router.get("/todos")
def read_all_todos(db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return admin_controller.get_all_todo_list(db)

@router.delete("/todos/{todo_id}")
def delete_todo_by_admin(todo_id: int, db: Session = Depends(get_db),  current_user: dict = Depends(get_current_admin)):
    return admin_controller.delete_todo_by_admin(db, todo_id)

# 카테고리 종류 등록 (관리자용)
@router.post("/category-types")
def create_category_type(payload: todos_schemas.CategoryTypeCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return admin_controller.create_todo_category_type(db, payload)

# 등록된 카테고리 종류 조회
@router.get("/category-types")
def get_category_types( db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return admin_controller.get_todo_category_types(db)

@router.patch("/category-types/{cat_id}") # 부분 수정이므로 PATCH 권장
def update_category( cat_id: int, cat_data: dict, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return admin_controller.update_category(db, cat_id, cat_data)

@router.delete("/category-types/{cat_id}")
def delete_category( cat_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return admin_controller.delete_category(db, cat_id)

@router.get("/attendance/all")
def get_all_attendance(user_name: Optional[str] = None,work_date: Optional[str] = None,db: Session = Depends(get_db),current_user: dict = Depends(get_current_admin)):
    return admin_controller.get_all_attendance(db, user_name, work_date)

@router.get("/users", response_model=list[UserResponse])
def read_all_users(db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return admin_controller.get_all_users(db)

# 신규 사용자 등록
@router.post("/users", response_model=UserResponse)
def create_user(payload: UserCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return admin_controller.register_user(db, payload)

# 사용자 정보 수정
@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return admin_controller.update_user_info(db, user_id, payload)

@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return admin_controller.delete_user(db, user_id)

# 1. 공휴일 목록 조회
@router.get("/holidays", response_model=List[HolidayOut])
def list_holidays(year: int = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return holiday_controller.get_holidays(db, year)

# 2. 공휴일 등록
@router.post("/holidays", response_model=HolidayOut)
def add_holiday(holiday_data: HolidayCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    # 관리자 체크 로직 필요 시 위와 동일하게 적용
    return holiday_controller.create_holiday(db, holiday_data)

# 3. 공휴일 삭제
@router.delete("/holidays/{holiday_id}")
def remove_holiday(holiday_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    # 관리자 체크 로직 필요 시 위와 동일하게 적용
    return holiday_controller.delete_holiday(db, holiday_id)

# 4. 공공데이터 공휴일 자동 동기화 (Sync)
@router.post("/holidays/sync/{year}")
def sync_public_holidays(year: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    # 관리자 체크 로직 (필요시)
    return holiday_controller.sync_holidays_from_api(db, year)
@router.post("/vacations/sync")
def sync_vacation(db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return admin_controller.sync_vacation(db)