"""경로 기반 멀티테넌시 — 요청별 테넌트 컨텍스트."""

from __future__ import annotations

import re
from typing import cast

from fastapi import Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from db.session import get_db
from models.tenant_models import Tenant

TENANT_HEADER = "X-Tenant-Slug"
TENANT_SLUG_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$")

# 정적·API 경로와 충돌 방지
RESERVED_TENANT_SLUGS = frozenset({
	"api",
	"static",
	"assets",
	"uploads",
	"manifest.json",
	"asset-manifest.json",
	"robots.txt",
	"favicon.ico",
	"logo192.png",
	"logo512.png",
	"docs",
	"health",
	"platform",
})


def normalize_tenant_slug(raw: str | None) -> str | None:
	if raw is None:
		return None
	slug = raw.strip().lower()
	if not slug:
		return None
	return slug


def validate_tenant_slug_format(slug: str) -> None:
	if slug in RESERVED_TENANT_SLUGS:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="사용할 수 없는 테넌트 식별자입니다.",
		)
	if not TENANT_SLUG_PATTERN.match(slug):
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="테넌트 식별자는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.",
		)


def get_tenant_by_slug(db: Session, slug: str) -> Tenant:
	validate_tenant_slug_format(slug)
	tenant = db.query(Tenant).filter(Tenant.slug == slug, Tenant.is_active.is_(True)).first()
	if not tenant:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="존재하지 않거나 비활성화된 기업입니다.",
		)
	return tenant


def tenant_pk(tenant: Tenant) -> int:
	"""SQLAlchemy 인스턴스 pk — Column[int] 타입 오탐 방지."""
	return cast(int, tenant.id)


def tenant_slug_str(tenant: Tenant) -> str:
	"""SQLAlchemy 인스턴스 slug — Column[str] 타입 오탐 방지."""
	return cast(str, tenant.slug)


async def get_tenant_slug_header(
	x_tenant_slug: str | None = Header(default=None, alias=TENANT_HEADER),
) -> str | None:
	return normalize_tenant_slug(x_tenant_slug)


async def require_tenant(
	db: Session = Depends(get_db),
	tenant_slug: str | None = Depends(get_tenant_slug_header),
) -> Tenant:
	if not tenant_slug:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="테넌트 정보가 필요합니다. (X-Tenant-Slug 헤더)",
		)
	return get_tenant_by_slug(db, tenant_slug)


async def require_tenant_header_or_query(
	db: Session = Depends(get_db),
	tenant_slug: str | None = Depends(get_tenant_slug_header),
	tenant_query: str | None = Query(default=None, alias="tenant"),
) -> Tenant:
	"""img·iframe 등 헤더를 못 실을 때 tenant 쿼리로 테넌트를 식별합니다."""
	slug = tenant_slug or normalize_tenant_slug(tenant_query)
	if not slug:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="테넌트 정보가 필요합니다. (X-Tenant-Slug 헤더 또는 tenant 쿼리)",
		)
	return get_tenant_by_slug(db, slug)


def assert_token_tenant_matches(current_user: dict, tenant: Tenant) -> None:
	token_tid = current_user.get("tenantId")
	if token_tid is None:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="테넌트 정보가 없는 토큰입니다. 다시 로그인해 주세요.",
		)
	if int(token_tid) != tenant_pk(tenant):
		raise HTTPException(
			status_code=status.HTTP_403_FORBIDDEN,
			detail="다른 기업 계정으로 로그인되어 있습니다.",
		)
