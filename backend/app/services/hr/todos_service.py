from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_
# ✅ 모듈 안의 특정 클래스들을 직접 임포트합니다.
from app.models.hr_models import Todo, TodoConfig, TodoCategoryType
from app.schemas.hr.todos_schemas import TodoCreate, TodoUpdate, TodoConfigBase
# --- Todo CRUD ---

# 모든 목록 조회
def get_todos(db: Session, user_id: str, skip: int = 0, limit: int = 100):
    return db.query(Todo).options(
        joinedload(Todo.author)
    ).filter(
        or_(
            Todo.category != "report",
            and_(
                Todo.category == "report",
                Todo.user_id == user_id
            )
        )
    ).offset(skip).limit(limit).all()

def create_todo(db: Session, todo: TodoCreate, user_id: str):
    todo_data = todo.model_dump(exclude={"user_id"}) 
    db_todo = Todo(**todo_data, user_id=user_id)
    db.add(db_todo)
    db.commit()
    db.refresh(db_todo)
    return db_todo

def update_todo(db: Session, todo_id: int, todo_update: TodoUpdate, user_id: str):
    db_todo = db.query(Todo).filter(Todo.id == todo_id, Todo.user_id == user_id).first()
    if db_todo:
        update_data = todo_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_todo, key, value)
        db.add(db_todo)
        db.commit()
        db.refresh(db_todo)
    return db_todo

def delete_todo(db: Session, todo_id: int, user_id: str):
    db_todo = db.query(Todo).filter(Todo.id == todo_id, Todo.user_id == user_id).first()
    if db_todo:
        db.delete(db_todo)
        db.commit()
    return db_todo

def get_categories(db: Session):
    return db.query(TodoCategoryType).all()

def get_todo_configs(db: Session, user_id: str):
    return db.query(TodoConfig).filter(TodoConfig.user_id == user_id).all()

def upsert_todo_config(db: Session, user_id: str, config_in: TodoConfigBase):
    """
    등록과 수정을 한 번에 처리 (Upsert)
    """
    # 1. 기존 설정이 있는지 확인
    db_config = db.query(TodoConfig).filter(TodoConfig.user_id == user_id, TodoConfig.category_key == config_in.category_key).first()
    if db_config:
        # 2. 존재하면 수정 (Update)
        db_config.color = config_in.color
        db_config.default_description = config_in.default_description
    else:
        # 3. 존재하지 않으면 생성 (Create)
        db_config = TodoConfig(user_id=user_id, **config_in.model_dump())
        db.add(db_config)

    db.commit()
    db.refresh(db_config)
    return db_config