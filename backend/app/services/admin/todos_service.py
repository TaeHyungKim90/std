from datetime import date, datetime, time

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from fastapi import HTTPException
from constants.vacation_categories import (
	VACATION_TODO_CATEGORIES,
)
from models.hr_models import Todo
from models.auth_models import User
from services.admin.user_service import sync_user_vacation

def get_all_todos_with_author(db: Session, skip: int = 0, limit: int = 100):
	return db.query(Todo).options(joinedload(Todo.author)).order_by(Todo.created_at.desc()).offset(skip).limit(limit).all()


def count_all_todos(db: Session) -> int:
	return db.query(Todo).count()

def delete_todo_by_admin(db: Session, todo_id: int):
	todo = db.query(Todo).filter(Todo.id == todo_id).first()
	if not todo:
		raise HTTPException( status_code=404, detail="삭제하려는 일정을 찾을 수 없습니다." )

	user_id = str(todo.user_id)
	user = db.query(User).filter(User.user_login_id == user_id).first()
	db.delete(todo)
	db.flush()
	if user:
		sync_user_vacation(db, user)
	db.commit()
	return {"status": "success", "message": f"일정이 관리자에 의해 삭제되었습니다."}


def get_vacation_todos_for_date(db: Session, work_date: str | date):
	"""
	특정 날짜(work_date)에 걸쳐있는 '연차/휴가' todo 목록 조회.
	- overlap 기준: start_date <= day_end AND (end_date IS NULL OR end_date >= day_start)
	- 조회 카테고리: 연차/휴가로 정의된 todo category_key들
	"""

	if isinstance(work_date, str):
		parsed = datetime.strptime(work_date, "%Y-%m-%d").date()
	else:
		parsed = work_date

	day_start = datetime.combine(parsed, time.min)
	day_end = datetime.combine(parsed, time.max)

	q = (
		db.query(Todo)
		.options(joinedload(Todo.author))
		.filter(Todo.category.in_(VACATION_TODO_CATEGORIES))
		.filter(
			Todo.start_date <= day_end,
			or_(Todo.end_date == None, Todo.end_date >= day_start),  # noqa: E711
		)
		.order_by(Todo.start_date.asc())
	)
	return q.all()