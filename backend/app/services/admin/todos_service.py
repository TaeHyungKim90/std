from datetime import date, datetime, time

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from fastapi import HTTPException
from constants.vacation_categories import VACATION_TODO_CATEGORIES
from models.hr_models import Todo
from models.auth_models import User
from services.admin.user_service import sync_user_vacation
from services.tenant_scope import get_user_by_login_id, todos_in_tenant


def get_all_todos_with_author(db: Session, tenant_id: int, skip: int = 0, limit: int = 100):
	return (
		todos_in_tenant(db, tenant_id)
		.options(joinedload(Todo.author))
		.order_by(Todo.created_at.desc())
		.offset(skip)
		.limit(limit)
		.all()
	)


def count_all_todos(db: Session, tenant_id: int) -> int:
	return todos_in_tenant(db, tenant_id).count()


def delete_todo_by_admin(db: Session, tenant_id: int, todo_id: int):
	todo = todos_in_tenant(db, tenant_id).filter(Todo.id == todo_id).first()
	if not todo:
		raise HTTPException(status_code=404, detail="삭제하려는 일정을 찾을 수 없습니다.")

	user_id = str(todo.user_id)
	user = get_user_by_login_id(db, tenant_id, user_id)
	db.delete(todo)
	db.flush()
	if user:
		sync_user_vacation(db, user)
	db.commit()
	return {"status": "success", "message": "일정이 관리자에 의해 삭제되었습니다."}


def get_vacation_todos_for_date(db: Session, tenant_id: int, work_date: str | date):
	if isinstance(work_date, str):
		parsed = datetime.strptime(work_date, "%Y-%m-%d").date()
	else:
		parsed = work_date

	day_start = datetime.combine(parsed, time.min)
	day_end = datetime.combine(parsed, time.max)

	q = (
		todos_in_tenant(db, tenant_id)
		.options(joinedload(Todo.author))
		.filter(Todo.category.in_(VACATION_TODO_CATEGORIES))
		.filter(
			Todo.start_date <= day_end,
			or_(Todo.end_date == None, Todo.end_date >= day_start),  # noqa: E711
		)
		.order_by(Todo.start_date.asc())
	)
	return q.all()
