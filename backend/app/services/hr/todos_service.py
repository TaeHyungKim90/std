from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_
# ✅ 모듈 안의 특정 클래스들을 직접 임포트합니다.
from models.hr_models import Todo, TodoConfig, TodoCategoryType
from models.auth_models import UserVacation
from schemas.hr.todos_schemas import TodoCreate, TodoUpdate, TodoConfigBase
from fastapi import HTTPException
# --- Todo CRUD ---
# --- 헬퍼 함수: 카테고리에 따른 연차 차감 일수 계산 ---
def get_deduct_days(category_key: str) -> float:
    """카테고리 키에 따라 차감할 연차 일수를 반환합니다."""
    if category_key == "vacation_full":
        return 1.0
    elif category_key in ["vacation_am", "vacation_pm"]:
        return 0.5
    return 0.0

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
    print("날짜확인 :",todo.start_date," : ", todo.end_date)
    category_key = todo.category
    deduct_days = get_deduct_days(category_key)
    if deduct_days > 0:
        vacation = db.query(UserVacation).filter(UserVacation.user_id == user_id).first()
        if not vacation:
            raise HTTPException(status_code=400, detail="연차 정산 데이터가 없습니다. 관리자에게 문의하세요.")
        
        if vacation.remaining_days < deduct_days:
            raise HTTPException(status_code=400, detail=f"잔여 연차가 부족합니다. (현재: {vacation.remaining_days}일)")
            
        # 📉 연차 차감 실행
        vacation.used_days += deduct_days
        vacation.remaining_days -= deduct_days

    todo_data = todo.model_dump(exclude={"user_id"}) 
    db_todo = Todo(**todo_data, user_id=user_id)
    
    try:
        db.add(db_todo)
        db.commit()
        db.refresh(db_todo)
        return db_todo
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"일정 저장 중 오류 발생: {str(e)}")

def update_todo(db: Session, todo_id: int, todo_update: TodoUpdate, user_id: str):
    # 1. 기존 일정 데이터 가져오기
    db_todo = db.query(Todo).filter(Todo.id == todo_id, Todo.user_id == user_id).first()
    if not db_todo:
        return None
    # 2. 연차 관련 변동 사항 파악
    old_category = db_todo.category
    new_category = todo_update.category
    if new_category is not None and old_category != new_category:
        vacation = db.query(UserVacation).filter(UserVacation.user_id == user_id).first()
        if not vacation:
            raise HTTPException(status_code=400, detail="연차 정산 데이터가 없습니다.")
        # (A) 기존에 차감됐던 분량 원상복구 (환불)
        old_deduct = get_deduct_days(old_category)
        if old_deduct > 0:
                vacation.used_days -= old_deduct
                vacation.remaining_days += old_deduct
        # (B) 새로운 카테고리 기준으로 차감 (재차감)
        new_deduct = get_deduct_days(new_category)
        if new_deduct > 0:
            if vacation.remaining_days < new_deduct:
                # 롤백을 위해 다시 예전 상태로 돌려놓고 에러 발생
                vacation.used_days += old_deduct
                vacation.remaining_days -= old_deduct
                raise HTTPException(status_code=400, detail=f"잔여 연차가 부족하여 수정할 수 없습니다.")
            
            vacation.used_days += new_deduct
            vacation.remaining_days -= new_deduct

        # 안전장치: 사용 일수 마이너스 방지
        if vacation.used_days < 0: vacation.used_days = 0.0
        vacation.remaining_days = vacation.total_days - vacation.used_days
    # 3. 실제 DB 필드 업데이트
    update_data = todo_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_todo, key, value)
        
    try:
        db.commit()
        db.refresh(db_todo)
        return db_todo
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"수정 중 오류 발생: {str(e)}")

def delete_todo(db: Session, todo_id: int, user_id: str):
    """일정 삭제 및 연차 자동 환불 로직"""
    db_todo = db.query(Todo).filter(Todo.id == todo_id, Todo.user_id == user_id).first()
    if not db_todo:
        return None

    refund_days = get_deduct_days(db_todo.category)
    
    if refund_days > 0:
        vacation = db.query(UserVacation).filter(UserVacation.user_id == user_id).first()
        if vacation:
            vacation.used_days -= refund_days
            vacation.remaining_days += refund_days
            if vacation.used_days < 0: vacation.used_days = 0.0

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