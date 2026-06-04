import os
import shutil
from typing import cast

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from models.tenant_models import Tenant
from services.tenant_service import require_tenant_by_id

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "..", "..", "static"))
UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")
BRANDING_ROOT = os.path.join(UPLOAD_DIR, "tenant-branding")

DEFAULT_LOGO_URL = "/assets/icon/favicon.png"
DEFAULT_ICON_URL = "/assets/icon/favicon.png"

_REPO_ROOT = os.path.normpath(os.path.join(BASE_DIR, "..", "..", ".."))


def _api_branding_path(slug: str, kind: str) -> str:
	return f"/api/tenants/{slug}/branding/{kind}"


def _media_type_for_path(path: str) -> str:
	ext = os.path.splitext(path)[1].lower()
	return {
		".png": "image/png",
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".webp": "image/webp",
		".gif": "image/gif",
		".svg": "image/svg+xml",
	}.get(ext, "application/octet-stream")


def default_favicon_path() -> str | None:
	for p in (
		os.path.join(STATIC_DIR, "assets", "icon", "favicon.png"),
		os.path.join(STATIC_DIR, "icon", "favicon.png"),
		os.path.join(_REPO_ROOT, "frontend", "public", "assets", "icon", "favicon.png"),
	):
		if os.path.isfile(p):
			return p
	return None


def _branding_file_path(tenant_id: int, prefix: str) -> str | None:
	directory = os.path.join(BRANDING_ROOT, str(tenant_id))
	if not os.path.isdir(directory):
		return None
	for name in sorted(os.listdir(directory)):
		if name.startswith(prefix):
			full = os.path.join(directory, name)
			if os.path.isfile(full):
				return full
	return None


def resolve_logo_file(tenant: Tenant) -> str | None:
	if not (cast(str | None, tenant.logo_url) or "").strip():
		return None
	return _branding_file_path(cast(int, tenant.id), "logo")


def resolve_icon_file(tenant: Tenant) -> str | None:
	if not (cast(str | None, tenant.icon_url) or "").strip():
		return None
	return _branding_file_path(cast(int, tenant.id), "icon")

ALLOWED_CONTENT_TYPES = {
	"image/png",
	"image/jpeg",
	"image/jpg",
	"image/webp",
	"image/gif",
	"image/svg+xml",
}
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}
MAX_BYTES = 2 * 1024 * 1024


def _tenant_branding_dir(tenant_id: int) -> str:
	path = os.path.join(BRANDING_ROOT, str(tenant_id))
	os.makedirs(path, exist_ok=True)
	return path


def effective_logo_url(tenant: Tenant | None) -> str:
	if tenant is None:
		return DEFAULT_LOGO_URL
	if (cast(str | None, tenant.logo_url) or "").strip():
		return _api_branding_path(cast(str, tenant.slug), "logo")
	return DEFAULT_LOGO_URL


def effective_icon_url(tenant: Tenant | None) -> str:
	if tenant is None:
		return DEFAULT_ICON_URL
	if (cast(str | None, tenant.icon_url) or "").strip():
		return _api_branding_path(cast(str, tenant.slug), "icon")
	return DEFAULT_ICON_URL


def get_branding_payload(tenant: Tenant) -> dict:
	return {
		"tenant_id": cast(int, tenant.id),
		"slug": cast(str, tenant.slug),
		"name": cast(str, tenant.name),
		"logo_url": cast(str | None, tenant.logo_url),
		"icon_url": cast(str | None, tenant.icon_url),
		"logo_url_effective": effective_logo_url(tenant),
		"icon_url_effective": effective_icon_url(tenant),
		"default_logo_url": DEFAULT_LOGO_URL,
		"default_icon_url": DEFAULT_ICON_URL,
	}


def _safe_extension(filename: str | None, content_type: str | None) -> str:
	_, ext = os.path.splitext(filename or "")
	ext = ext.lower()
	if ext in ALLOWED_EXTENSIONS:
		return ext
	if content_type == "image/png":
		return ".png"
	if content_type in ("image/jpeg", "image/jpg"):
		return ".jpg"
	if content_type == "image/webp":
		return ".webp"
	if content_type == "image/gif":
		return ".gif"
	if content_type == "image/svg+xml":
		return ".svg"
	raise HTTPException(
		status_code=status.HTTP_400_BAD_REQUEST,
		detail="PNG, JPEG, WebP, GIF, SVG 이미지만 업로드할 수 있습니다.",
	)


def _validate_upload(file: UploadFile) -> None:
	ct = (file.content_type or "").lower()
	if ct and ct not in ALLOWED_CONTENT_TYPES:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="PNG, JPEG, WebP, GIF, SVG 이미지만 업로드할 수 있습니다.",
		)
	_safe_extension(file.filename, ct)


async def _write_branding_file(file: UploadFile, dest_path: str) -> None:
	_validate_upload(file)
	contents = await file.read()
	if len(contents) > MAX_BYTES:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="파일 크기는 2MB 이하여야 합니다.",
		)
	if not contents:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="빈 파일입니다.")
	os.makedirs(os.path.dirname(dest_path), exist_ok=True)
	with open(dest_path, "wb") as out:
		out.write(contents)


def _clear_prefix_files(directory: str, prefix: str) -> None:
	if not os.path.isdir(directory):
		return
	for name in os.listdir(directory):
		if name.startswith(prefix):
			try:
				os.remove(os.path.join(directory, name))
			except OSError:
				pass


async def save_tenant_logo(db: Session, tenant_id: int, file: UploadFile) -> Tenant:
	tenant = require_tenant_by_id(db, tenant_id)
	ext = _safe_extension(file.filename, file.content_type)
	branding_dir = _tenant_branding_dir(tenant_id)
	_clear_prefix_files(branding_dir, "logo")
	filename = f"logo{ext}"
	full_path = os.path.join(branding_dir, filename)
	await _write_branding_file(file, full_path)
	tenant.logo_url = f"/uploads/tenant-branding/{tenant_id}/{filename}"
	db.commit()
	db.refresh(tenant)
	return tenant


async def save_tenant_icon(db: Session, tenant_id: int, file: UploadFile) -> Tenant:
	tenant = require_tenant_by_id(db, tenant_id)
	ext = _safe_extension(file.filename, file.content_type)
	branding_dir = _tenant_branding_dir(tenant_id)
	_clear_prefix_files(branding_dir, "icon")
	filename = f"icon{ext}"
	full_path = os.path.join(branding_dir, filename)
	await _write_branding_file(file, full_path)
	tenant.icon_url = f"/uploads/tenant-branding/{tenant_id}/{filename}"
	db.commit()
	db.refresh(tenant)
	return tenant


def remove_tenant_branding_files(tenant_id: int) -> None:
	path = os.path.join(BRANDING_ROOT, str(tenant_id))
	if os.path.isdir(path):
		shutil.rmtree(path, ignore_errors=True)
