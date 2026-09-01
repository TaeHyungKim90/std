import os

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from core.tenant import get_tenant_by_slug, normalize_tenant_slug
from db.session import get_db
from services import tenant_branding_service, tenant_service

router = APIRouter(prefix="/tenants", tags=["Tenants"])


@router.get("")
def list_tenants(db: Session = Depends(get_db)):
	"""활성 테넌트 목록 (랜딩·테넌트 선택용)."""
	rows = tenant_service.list_active_tenants(db)
	return [{"slug": t.slug, "name": t.name} for t in rows]


def _serve_tenant_branding_file(tenant, kind: str) -> FileResponse:
	if kind == "logo":
		path = tenant_branding_service.resolve_logo_file(tenant)
		default = tenant_branding_service.default_favicon_path()
	elif kind == "icon":
		path = tenant_branding_service.resolve_icon_file(tenant)
		default = tenant_branding_service.default_favicon_path()
	else:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

	if path and os.path.isfile(path):
		return FileResponse(path, media_type=tenant_branding_service._media_type_for_path(path))
	if default and os.path.isfile(default):
		return FileResponse(default, media_type="image/png")
	raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="브랜딩 이미지를 찾을 수 없습니다.")


@router.get("/{slug}/branding/logo")
def tenant_branding_logo(slug: str, db: Session = Depends(get_db)):
	normalized = normalize_tenant_slug(slug)
	tenant = tenant_service.get_tenant_or_none(db, normalized) if normalized else None
	if not tenant:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="테넌트를 찾을 수 없습니다.")
	return _serve_tenant_branding_file(tenant, "logo")


@router.get("/{slug}/branding/icon")
def tenant_branding_icon(slug: str, db: Session = Depends(get_db)):
	normalized = normalize_tenant_slug(slug)
	tenant = tenant_service.get_tenant_or_none(db, normalized) if normalized else None
	if not tenant:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="테넌트를 찾을 수 없습니다.")
	return _serve_tenant_branding_file(tenant, "icon")


@router.get("/{slug}/exists")
def tenant_exists(slug: str, db: Session = Depends(get_db)):
	normalized = normalize_tenant_slug(slug)
	if not normalized:
		return {"exists": False}
	tenant = tenant_service.get_tenant_or_none(db, normalized)
	if not tenant:
		return {"exists": False, "slug": normalized, "name": None}
	return {
		"exists": True,
		"slug": normalized,
		"name": tenant.name,
		"logo_url": tenant_branding_service.effective_logo_url(tenant),
		"icon_url": tenant_branding_service.effective_icon_url(tenant),
	}
