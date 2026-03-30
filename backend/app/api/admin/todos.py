from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from db.session import get_db
from services.auth_service import get_current_admin
from services.admin import todos_service
from schemas.hr import todos_schemas

router = APIRouter()

@router.get("/")
def read_all_todos(
	skip: int = Query(0, ge=0),
	limit: int = Query(20, ge=1, le=100),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin),
):
	"""[관리자] 전 직원 일정 목록(페이징)."""
	items = todos_service.get_all_todos_with_author(db, skip=skip, limit=limit)
	total = todos_service.count_all_todos(db)
	return {"items": items, "total": total}

@router.delete("/{todo_id}")
def delete_todo_by_admin(todo_id: int, db: Session = Depends(get_db), current_admin: dict = Depends(get_current_admin)):
	"""[관리자] 부적절하거나 잘못된 직원의 일정을 강제로 삭제합니다. (연차 환불 로직 포함)"""
	success = todos_service.delete_todo_by_admin(db, todo_id)
	if not success:
		raise HTTPException(status_code=404, detail="삭제하려는 일정을 찾을 수 없습니다.")
	return {"success": True, "message": "관리자 권한으로 삭제되었습니다."}


@router.get("/vacations/for-date", response_model=list[todos_schemas.Todo])
def get_vacation_todos_for_date(
	work_date: str = Query(..., description="조회할 날짜 (YYYY-MM-DD)"),
	db: Session = Depends(get_db),
	current_admin: dict = Depends(get_current_admin),
):
	"""[관리자] work_date에 걸친 연차/휴가(HR todos) 목록 조회 (직원별 포함)"""
	return todos_service.get_vacation_todos_for_date(db, work_date)