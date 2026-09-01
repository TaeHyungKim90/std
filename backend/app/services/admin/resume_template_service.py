import os
import shutil
import uuid
from typing import Optional, cast

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from models.recruitment_models import ResumeTemplate
from services import common_service as common_paths
from services.tenant_scope import resume_templates_in_tenant


def _upload_dir() -> str:
	d = common_paths.UPLOAD_DIR
	if not os.path.isdir(d):
		os.makedirs(d, exist_ok=True)
	return d


def count_active_templates(db: Session, tenant_id: int) -> int:
	return (
		resume_templates_in_tenant(db, tenant_id)
		.filter(ResumeTemplate.is_deleted.is_(False))
		.count()
	)


def get_default_template_id(db: Session, tenant_id: int) -> Optional[int]:
	row = (
		resume_templates_in_tenant(db, tenant_id)
		.filter(ResumeTemplate.is_deleted.is_(False), ResumeTemplate.is_default.is_(True))
		.first()
	)
	return cast(int, row.id) if row else None


def list_templates(db: Session, tenant_id: int, include_deleted: bool = False) -> list[ResumeTemplate]:
	q = resume_templates_in_tenant(db, tenant_id).order_by(ResumeTemplate.id.desc())
	if not include_deleted:
		q = q.filter(ResumeTemplate.is_deleted.is_(False))
	return q.all()


def list_templates_for_job_form(db: Session, tenant_id: int) -> list[ResumeTemplate]:
	return list_templates(db, tenant_id, include_deleted=False)


def _clear_other_defaults(db: Session, tenant_id: int, except_id: Optional[int]) -> None:
	q = resume_templates_in_tenant(db, tenant_id).filter(ResumeTemplate.is_deleted.is_(False))
	if except_id is not None:
		q = q.filter(ResumeTemplate.id != except_id)
	for t in q.all():
		t.is_default = False


def create_template(
	db: Session,
	tenant_id: int,
	*,
	name: str,
	file: UploadFile,
	set_default: bool,
) -> ResumeTemplate:
	if not name or not str(name).strip():
		raise HTTPException(status_code=400, detail="템플릿 이름을 입력해 주세요.")
	ext = os.path.splitext(file.filename or "")[1].lower()
	if ext != ".docx":
		raise HTTPException(status_code=400, detail="이력서 템플릿은 .docx 파일만 등록할 수 있습니다.")
	ct = (file.content_type or "").lower()
	if ct and "wordprocessingml" not in ct and ct not in ("application/octet-stream", "application/zip"):
		raise HTTPException(
			status_code=400,
			detail="유효한 Word(.docx) MIME 형식이 아닙니다.",
		)

	saved = f"{uuid.uuid4().hex}.docx"
	dest = os.path.join(_upload_dir(), saved)
	with open(dest, "wb") as out:
		shutil.copyfileobj(file.file, out)

	active = count_active_templates(db, tenant_id)
	if set_default or active == 0:
		_clear_other_defaults(db, tenant_id, None)
		is_def = True
	else:
		is_def = False

	row = ResumeTemplate(
		tenant_id=tenant_id,
		name=str(name).strip(),
		saved_name=saved,
		file_path=f"/uploads/{saved}",
		is_default=is_def,
		is_deleted=False,
	)
	db.add(row)
	db.commit()
	db.refresh(row)
	return row


def update_template(
	db: Session,
	tenant_id: int,
	template_id: int,
	*,
	name: str | None = None,
	file: UploadFile | None = None,
	is_default: bool | None = None,
) -> ResumeTemplate:
	row = (
		resume_templates_in_tenant(db, tenant_id)
		.filter(ResumeTemplate.id == template_id)
		.first()
	)
	if not row or row.is_deleted:
		raise HTTPException(status_code=404, detail="템플릿을 찾을 수 없습니다.")

	if file is not None:
		ext = os.path.splitext(file.filename or "")[1].lower()
		if ext != ".docx":
			raise HTTPException(status_code=400, detail="이력서 템플릿은 .docx 파일만 등록할 수 있습니다.")
		fct = (file.content_type or "").lower()
		if fct and "wordprocessingml" not in fct and fct not in ("application/octet-stream", "application/zip"):
			raise HTTPException(status_code=400, detail="유효한 Word(.docx) MIME 형식이 아닙니다.")
		old_saved = cast(str, row.saved_name)
		saved = f"{uuid.uuid4().hex}.docx"
		dest = os.path.join(_upload_dir(), saved)
		with open(dest, "wb") as out:
			shutil.copyfileobj(file.file, out)
		row.saved_name = saved
		row.file_path = f"/uploads/{saved}"
		try:
			old_path = os.path.join(_upload_dir(), old_saved)
			if old_saved and os.path.isfile(old_path):
				os.remove(old_path)
		except OSError:
			pass

	if name is not None:
		s = str(name).strip()
		if not s:
			raise HTTPException(status_code=400, detail="템플릿 이름을 입력해 주세요.")
		row.name = s

	if is_default is True:
		_clear_other_defaults(db, tenant_id, cast(int, row.id))
		row.is_default = True
	elif is_default is False and row.is_default:
		if count_active_templates(db, tenant_id) <= 1:
			raise HTTPException(
				status_code=400,
				detail="등록된 템플릿이 하나뿐이면 기본값을 해제할 수 없습니다.",
			)
		row.is_default = False
		other = (
			resume_templates_in_tenant(db, tenant_id)
			.filter(ResumeTemplate.is_deleted.is_(False), ResumeTemplate.id != row.id)
			.order_by(ResumeTemplate.id.asc())
			.first()
		)
		if other:
			other.is_default = True

	db.commit()
	db.refresh(row)
	return row


def soft_delete_template(db: Session, tenant_id: int, template_id: int) -> None:
	row = (
		resume_templates_in_tenant(db, tenant_id)
		.filter(ResumeTemplate.id == template_id)
		.first()
	)
	if not row or row.is_deleted:
		raise HTTPException(status_code=404, detail="템플릿을 찾을 수 없습니다.")
	if count_active_templates(db, tenant_id) <= 1:
		raise HTTPException(status_code=400, detail="마지막 활성 템플릿은 삭제할 수 없습니다.")
	row.is_deleted = True
	if row.is_default:
		row.is_default = False
		other = (
			resume_templates_in_tenant(db, tenant_id)
			.filter(ResumeTemplate.is_deleted.is_(False), ResumeTemplate.id != row.id)
			.order_by(ResumeTemplate.id.asc())
			.first()
		)
		if other:
			other.is_default = True
	db.commit()


def resolve_template_id_for_new_job(
	db: Session, tenant_id: int, requested_id: Optional[int]
) -> int:
	if count_active_templates(db, tenant_id) == 0:
		raise HTTPException(
			status_code=400,
			detail="등록된 이력서 템플릿이 없습니다. 템플릿을 먼저 등록한 뒤 공고를 작성해 주세요.",
		)
	if requested_id is not None:
		t = (
			resume_templates_in_tenant(db, tenant_id)
			.filter(ResumeTemplate.id == requested_id, ResumeTemplate.is_deleted.is_(False))
			.first()
		)
		if not t:
			raise HTTPException(status_code=400, detail="선택한 이력서 템플릿이 없거나 비활성화되었습니다.")
		return cast(int, t.id)
	did = get_default_template_id(db, tenant_id)
	if did is None:
		fallback = (
			resume_templates_in_tenant(db, tenant_id)
			.filter(ResumeTemplate.is_deleted.is_(False))
			.order_by(ResumeTemplate.id.asc())
			.first()
		)
		if not fallback:
			raise HTTPException(status_code=400, detail="사용 가능한 이력서 템플릿이 없습니다.")
		return cast(int, fallback.id)
	return did


def assert_template_active_for_job(
	db: Session, tenant_id: int, template_id: Optional[int]
) -> None:
	if template_id is None:
		return
	t = (
		resume_templates_in_tenant(db, tenant_id)
		.filter(ResumeTemplate.id == template_id, ResumeTemplate.is_deleted.is_(False))
		.first()
	)
	if not t:
		raise HTTPException(status_code=400, detail="선택한 이력서 템플릿이 없거나 비활성화되었습니다.")
