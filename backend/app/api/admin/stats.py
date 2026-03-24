# app/routers/admin/stats.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from services.admin import stats_service
from db.session import get_db
from services.auth_service import get_current_admin

router = APIRouter()

@router.get("/") # /api/admin/stats/ 가 됨
def read_stats(db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return stats_service.get_admin_stats(db)