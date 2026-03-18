from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException
from app.models.hr_models import Todo
from app.models.auth_models import UserVacation

def get_all_todos_with_author(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Todo).options(joinedload(Todo.author)).order_by(Todo.created_at.desc()).offset(skip).limit(limit).all()

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