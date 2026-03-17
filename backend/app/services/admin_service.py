from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.models.hr_models import Todo, TodoCategoryType, Attendance
from app.models.auth_models import User, UserVacation
from app.services.auth_service import get_password_hash
from app.schemas.auth_schemas import UserCreate, UserUpdate

from datetime import date

def get_admin_stats(db: Session):
    # 각 테이블의 count를 조회
    # 1.유저 수
    user_count = db.query(User).count() 
    # 2.카테고리수 수
    category_count = db.query(TodoCategoryType).count()
    # 3. 이번달 휴가자 수
    today = date.today();
    first_day = today.replace(day=1)
    if today.month == 12:
        last_day = today.replace(year=today.year + 1, month=1, day=1)
    else:
        last_day = today.replace(month=today.month + 1, day=1)
    vacation_query = db.query(
        Todo.id,
        User.user_name,
        TodoCategoryType.category_name.label("category"),
        Todo.start_date,
        Todo.end_date
    ).join(User, Todo.user_id == User.user_login_id) \
     .join(TodoCategoryType, Todo.category == TodoCategoryType.category_key) \
     .filter(
         func.date(Todo.start_date) < last_day,
         func.date(Todo.end_date) >= first_day,
         Todo.category.in_(['vacation_full', 'vacation_am', 'vacation_pm', 'vacation_special', 'vacation_sick'])
     ).order_by(Todo.start_date.asc()).all()

    today_vacations = [
        {
            "id": v.id,
            "user_name": v.user_name,
            "category": v.category,
            "start_date": v.start_date,
            "end_date": v.end_date
        } for v in vacation_query
    ]
    users_vacation_info = db.query(
        User.id,
        User.user_name,
        UserVacation.total_days,
        UserVacation.used_days,
        UserVacation.remaining_days
    ).outerjoin(UserVacation, User.user_login_id == UserVacation.user_id) \
     .filter(
         User.join_date.isnot(None),      # 👈 입사일이 있는 사람만
         User.resignation_date.is_(None)  # 👈 퇴사일이 없는 사람만 (재직중)
     ).order_by(User.user_name.asc()).all() # (선택사항) 이름 가나다순 정렬

    employee_balances = []
    for u in users_vacation_info:
        employee_balances.append({
            "id": u.id,
            "user_name": u.user_name,
            "total_days": u.total_days or 0,       # 정산 전이라 None일 경우 0으로 처리
            "used_days": u.used_days or 0.0,
            "remaining_days": u.remaining_days or 0.0
        })
    
    return {
        "user_count": user_count,
        "vacation_count": len(today_vacations),
        "category_count": category_count,
        "today_vacations": today_vacations,
        "employee_balances": employee_balances
    }

def get_all_todos_with_author(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Todo).options(
        joinedload(Todo.author)
    ).order_by(Todo.created_at.desc()).offset(skip).limit(limit).all()

def delete_todo_by_admin(db: Session, todo_id: int):
    todo = db.query(Todo).filter(Todo.id == todo_id).first()
    if not todo:
        raise HTTPException( status_code=404, detail="삭제하려는 일정을 찾을 수 없습니다." )

    if todo.category in ["vacation_full", "vacation_am", "vacation_pm"]:
        refund_days = 1.0 if todo.category == "vacation_full" else 0.5
        vacation = db.query(UserVacation).filter(UserVacation.user_id == todo.user_id).first()
        if vacation:
            vacation.used_days -= refund_days
            vacation.remaining_days += refund_days
            if vacation.used_days < 0: 
                vacation.used_days = 0.0

    db.delete(todo)
    db.commit()
    return {"status": "success", "message": f"일정이 관리자에 의해 삭제되었습니다."}
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
    
    if "category_name" in cat_data: category.category_name = cat_data["category_name"]
    if "color" in cat_data: category.color = cat_data["color"]
    if "icon" in cat_data: category.icon = cat_data["icon"]
    
    db.commit()
    db.refresh(category)
    return category

def delete_category_type(db: Session, cat_id: int):

    category = db.query(TodoCategoryType).filter(TodoCategoryType.id == cat_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
    
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

    if user_name:
        query = query.filter(
            (User.user_name.contains(user_name)) | 
            (User.user_login_id.contains(user_name))
        )

    if work_date:
        query = query.filter(Attendance.work_date == work_date)
    results=query.order_by(Attendance.work_date.desc(), Attendance.clock_in_time.desc()).all()
    return [row._asdict() for row in results]

# 1. 전체 사용자 목록 조회
def get_all_users(db: Session):
    return db.query(User).options(joinedload(User.vacation)).order_by(User.id.desc()).all()

# 2. 신규 사용자 등록 (관리자용)
def create_user_by_admin(db: Session, payload: UserCreate):
    existing_user = db.query(User).filter(User.user_login_id == payload.user_login_id).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")

    hashed_pw = get_password_hash(payload.user_password)
    new_user = User(
        user_login_id=payload.user_login_id,
        user_password=hashed_pw,
        user_name=payload.user_name,
        user_nickname=payload.user_nickname,
        role=payload.role,
        join_date=payload.join_date,
        resignation_date=payload.resignation_date
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

    update_data = payload.model_dump(exclude_unset=True)
    update_data.pop("user_login_id", None)
    for key, value in update_data.items():
        if key == "user_password":
            if value:
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
    db.delete(user)
    db.commit()
    
    return {"status": "success", "message": f"사용자 '{user.user_login_id}'가 성공적으로 삭제되었습니다."}

def sync_all_users_vacation(db: Session):
    """모든 재직자의 입사일을 기준으로 연차를 자동 정산하여 테이블에 저장합니다."""
    # 입사일이 있고, 퇴사하지 않은(재직중인) 유저만 가져옵니다.
    users = db.query(User).filter(
        User.join_date.isnot(None),
        User.resignation_date.is_(None)
    ).all()
    
    today = date.today()
    updated_count = 0
    
    for user in users:
        join_date = user.join_date
        
        # 1. 근속 개월 수 및 연수 계산 (순수 파이썬 로직)
        months_diff = (today.year - join_date.year) * 12 + today.month - join_date.month
        if today.day < join_date.day:
            months_diff -= 1
            
        years_worked = months_diff // 12
        months_worked = months_diff % 12
        
        # 2. 총 연차 계산 (근로기준법)
        total_vacation = 0
        if years_worked == 0:
            # 1년 미만: 1개월 만근마다 1일
            total_vacation = months_diff
        else:
            # 1년 이상: 기본 15일 + (근속연수-1)//2 만큼 가산 (최대 25일)
            bonus_days = (years_worked - 1) // 2
            total_vacation = min(15 + bonus_days, 25)
            
        # 3. DB 테이블 업데이트 (없으면 생성, 있으면 수정)
        vacation_record = db.query(UserVacation).filter(UserVacation.user_id == user.user_login_id).first()
        
        if not vacation_record:
            vacation_record = UserVacation(user_id=user.user_login_id, used_days=0.0)
            db.add(vacation_record)
            
        vacation_record.total_days = total_vacation
        # 잔여 연차 = 총 연차 - 사용 연차
        vacation_record.remaining_days = total_vacation - vacation_record.used_days
        
        updated_count += 1
        
    db.commit()
    return {"message": f"총 {updated_count}명의 연차 정산 및 테이블 저장이 완료되었습니다."}
