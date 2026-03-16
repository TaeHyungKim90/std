from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from app.models.hr_models import Todo, TodoCategoryType, Attendance
from app.models.auth_models import User
from app.services.auth_service import get_password_hash
from app.schemas.auth_schemas import UserCreate, UserUpdate

def get_admin_stats(db: Session):
    # 각 테이블의 count를 조회
    users = db.query(User).all()
    print(f"DEBUG: 전체 유저 리스트 -> {users}")
    user_count = db.query(User).count()
    category_count = db.query(TodoCategoryType).count()
    vacation_count = db.query(Todo).filter(Todo.category == "vacation").count()
    
    return {
        "user_count": user_count,
        "vacation_count": vacation_count,
        "category_count": category_count
    }
#일정 Todo
def get_all_todos_with_author(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Todo).options(
        joinedload(Todo.author)
    ).order_by(Todo.created_at.desc()).offset(skip).limit(limit).all()

def delete_todo_by_admin(db: Session, todo_id: int):
    todo = db.query(Todo).filter(Todo.id == todo_id).first()
    if not todo:
        raise HTTPException( status_code=404, detail="삭제하려는 일정을 찾을 수 없습니다." )
    # 2. 삭제 실행
    db.delete(todo)
    db.commit()
    return {"status": "success", "message": f"일정 {todo_id}번이 관리자에 의해 삭제되었습니다."}
# Todo 카테고리
def get_all_category_types(db: Session):
    return db.query(TodoCategoryType).all()

    
def add_category_type(db: Session, payload):
    existing_type = db.query(TodoCategoryType).filter(
        TodoCategoryType.category_key == payload.category_key
    ).first()
    
    if existing_type:
        raise HTTPException(status_code=400, detail="이미 존재하는 카테고리 키입니다.")
    category_data = payload.model_dump() 
    new_type = TodoCategoryType(**category_data) 
    db.add(new_type)
    db.commit()
    db.refresh(new_type)
    return new_type

def update_category_type(db: Session, cat_id: int, cat_data: dict):
    category = db.query(TodoCategoryType).filter(TodoCategoryType.id == cat_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
    
    # 2. 데이터 업데이트 (값이 들어온 것만 변경)
    if "category_name" in cat_data: category.category_name = cat_data["category_name"]
    if "color" in cat_data: category.color = cat_data["color"]
    
    db.commit()
    db.refresh(category)
    return category

def delete_category_type(db: Session, cat_id: int):
    # 1. 대상 조회
    category = db.query(TodoCategoryType).filter(TodoCategoryType.id == cat_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
    
    # 💡 중요: 해당 카테고리를 사용하는 Todo가 있는지 체크 (선택 사항)
    count = db.query(Todo).filter(Todo.category == category.category_key).count()
    if count > 0:
        raise HTTPException(status_code=400, detail="사용 중인 카테고리는 삭제할 수 없습니다.")

    db.delete(category)
    db.commit()
    return {"message": "카테고리가 삭제되었습니다."}
def get_all_attendance(db: Session, user_name: str = None, work_date: str = None):
    query = db.query(
        Attendance.id,
        Attendance.work_date,
        Attendance.clock_in_time,
        Attendance.clock_out_time,
        Attendance.clock_in_location,
        Attendance.work_minutes,
        User.user_name,
        Attendance.user_id
    ).join(User, Attendance.user_id == User.user_login_id)

    # 🔍 이름/아이디 검색 필터 (부분 일치)
    if user_name:
        query = query.filter(
            (User.user_name.contains(user_name)) | 
            (User.user_login_id.contains(user_name))
        )

    # 📅 날짜 검색 필터 (정확한 날짜 일치)
    if work_date:
        query = query.filter(Attendance.work_date == work_date)
    results=query.order_by(Attendance.work_date.desc(), Attendance.clock_in_time.desc()).all()
    return [row._asdict() for row in results]

# 1. 전체 사용자 목록 조회
def get_all_users(db: Session):
    return db.query(User).order_by(User.id.desc()).all()

# 2. 신규 사용자 등록 (관리자용)
def create_user_by_admin(db: Session, payload: UserCreate):
    # 아이디 중복 체크
    existing_user = db.query(User).filter(User.user_login_id == payload.user_login_id).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")

    # 비밀번호 해싱 후 저장
    hashed_pw = get_password_hash(payload.user_password)
    new_user = User(
        user_login_id=payload.user_login_id,
        user_password=hashed_pw,
        user_name=payload.user_name,
        user_nickname=payload.user_nickname,
        role=payload.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# 3. 사용자 정보 수정
def update_user_by_admin(db: Session, user_id: int, payload: UserUpdate):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    update_data = payload.model_dump(exclude_unset=True) # 값이 들어온 필드만 추출
    update_data.pop("user_login_id", None)
    for key, value in update_data.items():
        if key == "user_password" and value: # 비밀번호 변경 시 해싱 처리
            setattr(user, key, get_password_hash(value))
        else:
            setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user

def delete_user_by_admin(db: Session, user_id: int):
    # 1. 대상 사용자 조회
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="삭제하려는 사용자를 찾을 수 없습니다.")

    # 🚨 주의: 해당 사용자의 출퇴근 기록(Attendance)이나 일정(Todo) 데이터가 
    # 외래키로 묶여 있다면 삭제 시 에러가 날 수 있습니다. 
    # (필요 시 연관 데이터도 같이 삭제하거나 처리하는 로직이 추가될 수 있음)

    # 2. 삭제 실행
    db.delete(user)
    db.commit()
    
    return {"status": "success", "message": f"사용자 '{user.user_login_id}'가 성공적으로 삭제되었습니다."}
