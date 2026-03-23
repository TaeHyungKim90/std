from sqlalchemy.orm import Session
from services.admin import user_service # 사용자 전용 서비스로 분리 권장

def get_all_users(db: Session):
    return user_service.get_all_users(db)

def register_user(db: Session, payload):
    return user_service.create_user_by_admin(db, payload)

def update_user_info(db: Session, user_id: int, payload):
    return user_service.update_user_by_admin(db, user_id, payload)

def delete_user(db: Session, user_id: int):
    return user_service.delete_user_by_admin(db, user_id)

def sync_vacation(db: Session):
    # 입사일 기준 연차 자동 정산 서비스 호출
    return user_service.sync_all_users_vacation(db)