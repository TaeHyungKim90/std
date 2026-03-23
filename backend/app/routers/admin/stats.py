# app/routers/admin/stats.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from controllers.admin import stats_controller as controller # 💡 경로 확인 필요
from db.session import get_db
from services.auth_service import get_current_admin

router = APIRouter(tags=["Admin Stats"])

@router.get("/") # /api/admin/stats/ 가 됨
def read_stats(db: Session = Depends(get_db), current_user: dict = Depends(get_current_admin)):
    return controller.get_dashboard_statistics(db)