from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.tenant import get_tenant_by_slug, normalize_tenant_slug
from db.session import get_db
from services import tenant_service

router = APIRouter(prefix="/tenants", tags=["Tenants"])


@router.get("")
def list_tenants(db: Session = Depends(get_db)):
	"""활성 테넌트 목록 (랜딩·테넌트 선택용)."""
	rows = tenant_service.list_active_tenants(db)
	return [{"slug": t.slug, "name": t.name} for t in rows]


@router.get("/{slug}/exists")
def tenant_exists(slug: str, db: Session = Depends(get_db)):
	normalized = normalize_tenant_slug(slug)
	if not normalized:
		return {"exists": False}
	tenant = tenant_service.get_tenant_or_none(db, normalized)
	return {"exists": tenant is not None, "slug": normalized, "name": tenant.name if tenant else None}
