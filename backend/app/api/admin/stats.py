from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.deps import tenant_id_from_user
from db.session import get_db
from services.auth_service import get_current_admin_for_tenant
from services.admin import stats_service

router = APIRouter()


@router.get("/")
def read_stats(
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_admin_for_tenant),
):
	return stats_service.get_admin_stats(db, tenant_id_from_user(current_user))
