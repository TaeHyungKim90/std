from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from models.hr_models import Todo, TodoCategoryType
from models.auth_models import User, UserVacation

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


# # Todo 카테고리





