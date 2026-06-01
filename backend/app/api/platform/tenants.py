from datetime import datetime
from typing import cast

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.platform_schemas import TenantAdminResponse, TenantCreateRequest, TenantUpdateRequest
from services.platform_auth_service import get_current_platform_admin
from services import tenant_service

router = APIRouter(prefix="/tenants", tags=["Platform Tenants"])


def _to_response(tenant) -> TenantAdminResponse:
	return TenantAdminResponse(
		id=cast(int, tenant.id),
		slug=cast(str, tenant.slug),
		name=cast(str, tenant.name),
		is_active=bool(tenant.is_active),
		created_at=cast(datetime, tenant.created_at),
	)


@router.get("", response_model=list[TenantAdminResponse])
def list_tenants(
	db: Session = Depends(get_db),
	_current: dict = Depends(get_current_platform_admin),
):
	return [_to_response(t) for t in tenant_service.list_all_tenants(db)]


@router.post("", response_model=TenantAdminResponse, status_code=201)
def create_tenant(
	payload: TenantCreateRequest,
	db: Session = Depends(get_db),
	_current: dict = Depends(get_current_platform_admin),
):
	return _to_response(tenant_service.create_tenant(db, payload))


@router.patch("/{tenant_id}", response_model=TenantAdminResponse)
def update_tenant(
	tenant_id: int,
	payload: TenantUpdateRequest,
	db: Session = Depends(get_db),
	_current: dict = Depends(get_current_platform_admin),
):
	return _to_response(tenant_service.update_tenant(db, tenant_id, payload))
