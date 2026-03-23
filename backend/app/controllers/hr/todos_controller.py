from sqlalchemy.orm import Session
from fastapi import HTTPException
from services.hr import todos_service
from schemas.hr import todos_schemas

# --- 할 일 (Todo) 관리 ---

# 모든 할 일 조회
def get_all_todos(db: Session, skip: int, limit: int, current_user: dict):
    user_id = current_user.get("userId")
    return todos_service.get_todos(db, user_id=user_id, skip=skip, limit=limit)

# 새로운 할 일 생성
def create_new_todo(db: Session, todo: todos_schemas.TodoCreate, current_user: dict):
    user_id = current_user.get("userId")
    return todos_service.create_todo(db=db, todo=todo, user_id=user_id)

# 할 일 수정 (403 예외 처리 포함)
def update_existing_todo(db: Session, todo_id: int, todo: todos_schemas.TodoUpdate, current_user: dict):
    user_id = current_user.get("userId")
    db_todo = todos_service.update_todo(db, todo_id, todo, user_id=user_id)
    if db_todo is None:
        raise HTTPException(status_code=403, detail="수정 권한이 없거나 해당 일정을 찾을 수 없습니다.")
    return db_todo

# 할 일 삭제 (403 예외 처리 포함)
def delete_existing_todo(db: Session, todo_id: int, current_user: dict):
    user_id = current_user.get("userId")
    db_todo = todos_service.delete_todo(db, todo_id, user_id)
    if db_todo is None:
        raise HTTPException(status_code=403, detail="삭제 권한이 없거나 해당 일정을 찾을 수 없습니다.")
    return db_todo

# --- 카테고리 가져오기 --
def get_categories(db: Session):
    return todos_service.get_categories(db)
# --- 카테고리 환경설정 (TodoConfig) 관리 ---

# 유저별 카테고리 설정 조회
def get_todo_configs(db: Session, current_user: dict):
    user_id = current_user.get("userId")
    return todos_service.get_todo_configs(db, user_id=user_id)

# 유저별 카테고리 설정 등록 및 수정 (Upsert)
def upsert_todo_config(db: Session, current_user: dict, config_in: todos_schemas.TodoConfigBase):
    user_id = current_user.get("userId")
    return todos_service.upsert_todo_config(db, user_id=user_id, config_in=config_in)