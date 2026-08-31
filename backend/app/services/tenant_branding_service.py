import os
import shutil
from pathlib import Path
from typing import cast

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from models.tenant_models import Tenant
from services.tenant_service import require_tenant_by_id

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "..", "..", "static"))
UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")
BRANDING_ROOT = os.path.join(UPLOAD_DIR, "tenant-branding")
_BRANDING_ROOT = Path(BRANDING_ROOT).resolve()

DEFAULT_LOGO_URL = "/assets/icon/favicon.png"
DEFAULT_ICON_URL = "/assets/icon/favicon.png"

_REPO_ROOT = os.path.normpath(os.path.join(BASE_DIR, "..", "..", ".."))
_BRANDING_ASSET_PREFIXES = frozenset({"logo", "icon"})


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


def _require_positive_tenant_id(tenant_id: int) -> int:
	tid = int(tenant_id)
	if tid <= 0:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 테넌트 ID입니다.")
	return tid


def _path_under_branding_root(*parts: str) -> Path:
	candidate = _BRANDING_ROOT.joinpath(*parts).resolve()
	try:
		candidate.relative_to(_BRANDING_ROOT)
	except ValueError as exc:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="브랜딩 파일 경로가 올바르지 않습니다.",
		) from exc
	return candidate


def _safe_branding_entry_name(name: str) -> bool:
	if not name or name in {".", ".."}:
		return False
	return Path(name).name == name and "/" not in name and "\\" not in name


def _branding_file_path(tenant_id: int, prefix: str) -> str | None:
	if prefix not in _BRANDING_ASSET_PREFIXES:
		return None
	tid = _require_positive_tenant_id(tenant_id)
	directory = _path_under_branding_root(str(tid))
	if not directory.is_dir():
		return None
	for entry in sorted(directory.iterdir(), key=lambda p: p.name):
		name = entry.name
		if not _safe_branding_entry_name(name):
			continue
		if name.startswith(prefix) and entry.is_file():
			return str(entry)
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


def _tenant_branding_dir(tenant_id: int) -> Path:
	tid = _require_positive_tenant_id(tenant_id)
	path = _path_under_branding_root(str(tid))
	path.mkdir(parents=True, exist_ok=True)
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
	_, ext = os.path.splitext(os.path.basename(filename or ""))
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


async def _write_branding_file(
	file: UploadFile,
	*,
	tenant_id: int,
	asset_prefix: str,
	ext: str,
) -> Path:
	if asset_prefix not in _BRANDING_ASSET_PREFIXES:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 브랜딩 종류입니다.")
	if ext not in ALLOWED_EXTENSIONS:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="허용되지 않은 파일 확장자입니다.")
	_validate_upload(file)
	contents = await file.read()
	if len(contents) > MAX_BYTES:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="파일 크기는 2MB 이하여야 합니다.",
		)
	if not contents:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="빈 파일입니다.")
	dest_path = _path_under_branding_root(str(_require_positive_tenant_id(tenant_id)), f"{asset_prefix}{ext}")
	dest_path.parent.mkdir(parents=True, exist_ok=True)
	dest_path.write_bytes(contents)
	return dest_path


def _clear_prefix_files(tenant_id: int, prefix: str) -> None:
	if prefix not in _BRANDING_ASSET_PREFIXES:
		return
	directory = _path_under_branding_root(str(_require_positive_tenant_id(tenant_id)))
	if not directory.is_dir():
		return
	for entry in directory.iterdir():
		name = entry.name
		if not _safe_branding_entry_name(name):
			continue
		if name.startswith(prefix) and entry.is_file():
			try:
				entry.unlink()
			except OSError:
				pass


async def save_tenant_logo(db: Session, tenant_id: int, file: UploadFile) -> Tenant:
	tenant = require_tenant_by_id(db, tenant_id)
	ext = _safe_extension(file.filename, file.content_type)
	tid = _require_positive_tenant_id(tenant_id)
	_tenant_branding_dir(tid)
	_clear_prefix_files(tid, "logo")
	filename = f"logo{ext}"
	await _write_branding_file(file, tenant_id=tid, asset_prefix="logo", ext=ext)
	tenant.logo_url = f"/uploads/tenant-branding/{tid}/{filename}"
	db.commit()
	db.refresh(tenant)
	return tenant


async def save_tenant_icon(db: Session, tenant_id: int, file: UploadFile) -> Tenant:
	tenant = require_tenant_by_id(db, tenant_id)
	ext = _safe_extension(file.filename, file.content_type)
	tid = _require_positive_tenant_id(tenant_id)
	_tenant_branding_dir(tid)
	_clear_prefix_files(tid, "icon")
	filename = f"icon{ext}"
	await _write_branding_file(file, tenant_id=tid, asset_prefix="icon", ext=ext)
	tenant.icon_url = f"/uploads/tenant-branding/{tid}/{filename}"
	db.commit()
	db.refresh(tenant)
	return tenant


def remove_tenant_branding_files(tenant_id: int) -> None:
	path = _path_under_branding_root(str(_require_positive_tenant_id(tenant_id)))
	if path.is_dir():
		shutil.rmtree(path, ignore_errors=True)
