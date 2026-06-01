import logging
import os
from typing import List, Optional, cast

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from db.session import get_db
from models.common_models import UploadedFile
from schemas.common_schemas import FileUploadResponse
from services import common_service as service
from services.auth_service import get_current_user_for_tenant

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".doc", ".docx"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

MSG_FILE_NOT_ON_DISK = "File not found on disk."
MSG_FILE_NOT_FOUND = "File not found."
MSG_BAD_FILENAME = "Invalid file name."
MSG_BAD_EXT = "File type not allowed."
MSG_TOO_LARGE = "File size exceeds 50MB."
MSG_UPLOAD_ERROR = "File upload failed."


def _file_response_for_row(row: UploadedFile):
	saved_name = str(row.saved_name)
	full_path = os.path.join(service.UPLOAD_DIR, saved_name)
	if not os.path.isfile(full_path):
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail=MSG_FILE_NOT_ON_DISK,
		)
	raw_ct = cast(Optional[str], row.content_type)
	media = raw_ct or "application/octet-stream"
	return FileResponse(
		full_path,
		filename=str(row.original_name),
		media_type=media,
		content_disposition_type="inline",
	)


@router.get("/files/by-saved-name/{saved_name:path}")
async def download_file_by_saved_name(
	saved_name: str,
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	safe = os.path.basename(saved_name.strip().replace("\\", "/"))
	if not safe or ".." in saved_name:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=MSG_BAD_FILENAME,
		)
	row = db.query(UploadedFile).filter(UploadedFile.saved_name == safe).first()
	if not row:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail=MSG_FILE_NOT_FOUND,
		)
	service.assert_user_may_download_uploaded_file(db, current_user, row)
	return _file_response_for_row(row)


@router.get("/download/{file_id}")
async def download_file_legacy_path(
	file_id: int,
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	row = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
	if not row:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail=MSG_FILE_NOT_FOUND,
		)
	service.assert_user_may_download_uploaded_file(db, current_user, row)
	return _file_response_for_row(row)


@router.get("/files/{file_id}")
async def download_file(
	file_id: int,
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	row = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
	if not row:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail=MSG_FILE_NOT_FOUND,
		)
	service.assert_user_may_download_uploaded_file(db, current_user, row)
	return _file_response_for_row(row)


@router.post("/upload", response_model=List[FileUploadResponse])
async def upload_files(
	files: List[UploadFile] = File(...),
	db: Session = Depends(get_db),
	_current_user: dict = Depends(get_current_user_for_tenant),
):
	try:
		for file in files:
			ext = os.path.splitext(file.filename or "")[1].lower()

			if ext not in ALLOWED_EXTENSIONS:
				raise HTTPException(
					status_code=status.HTTP_400_BAD_REQUEST,
					detail=f"{MSG_BAD_EXT} Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
				)

			file.file.seek(0, 2)
			file_size = file.file.tell()
			file.file.seek(0)

			if file_size > MAX_FILE_SIZE:
				raise HTTPException(
					status_code=status.HTTP_400_BAD_REQUEST,
					detail=MSG_TOO_LARGE,
				)

		return await service.save_files_to_db_and_disk(db, files)

	except HTTPException:
		raise
	except Exception:
		db.rollback()
		logger.exception("Failed to upload files")
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=MSG_UPLOAD_ERROR,
		)
