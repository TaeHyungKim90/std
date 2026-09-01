from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.platform_schemas import TenantBrandingResponse
from services.platform_auth_service import get_current_platform_admin
from services import tenant_branding_service, tenant_service

router = APIRouter(prefix="/tenants", tags=["Platform Tenant Branding"])


@router.get("/{tenant_id}/branding", response_model=TenantBrandingResponse)
def get_tenant_branding(
	tenant_id: int,
	db: Session = Depends(get_db),
	_current: dict = Depends(get_current_platform_admin),
):
	tenant = tenant_service.require_tenant_by_id(db, tenant_id)
	return tenant_branding_service.get_branding_payload(tenant)


@router.post("/{tenant_id}/branding/logo", response_model=TenantBrandingResponse)
async def upload_tenant_logo(
	tenant_id: int,
	file: UploadFile = File(...),
	db: Session = Depends(get_db),
	_current: dict = Depends(get_current_platform_admin),
):
	tenant = await tenant_branding_service.save_tenant_logo(db, tenant_id, file)
	return tenant_branding_service.get_branding_payload(tenant)


@router.post("/{tenant_id}/branding/icon", response_model=TenantBrandingResponse)
async def upload_tenant_icon(
	tenant_id: int,
	file: UploadFile = File(...),
	db: Session = Depends(get_db),
	_current: dict = Depends(get_current_platform_admin),
):
	tenant = await tenant_branding_service.save_tenant_icon(db, tenant_id, file)
	return tenant_branding_service.get_branding_payload(tenant)
