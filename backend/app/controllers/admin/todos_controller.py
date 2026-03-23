from sqlalchemy.orm import Session
from services.admin import todos_service # 기존 일정 서비스 활용 가능

def get_all_todo_list(db: Session):
    # 관리자용 전체 일정 조회 로직 (joinedload 포함)
    return todos_service.get_all_todos_with_author(db)

def delete_todo_by_admin(db: Session, todo_id: int):
    # 관리자 권한 삭제 로직 (연차 환불 로직 포함 권장)
    return todos_service.delete_todo_by_admin(db, todo_id)