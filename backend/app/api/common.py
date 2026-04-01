import logging
import os
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List

from db.session import get_db
from models.common_models import UploadedFile
from services import common_service as service
from services.auth_service import get_current_user
from schemas.common_schemas import FileUploadResponse

# 라우터 설정
router = APIRouter()
logger = logging.getLogger(__name__)

# 파일 업로드 정책 설정
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx"}
MAX_FILE_SIZE = 50 * 1024 * 1024 # 50MB


def _file_response_for_row(row: UploadedFile):
	full_path = os.path.join(service.UPLOAD_DIR, row.saved_name)
	if not os.path.isfile(full_path):
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="저장소에 파일이 없습니다.")
	media = row.content_type or "application/octet-stream"
	return FileResponse(
		full_path,
		filename=row.original_name,
		media_type=media,
		content_disposition_type="inline",
	)


@router.get("/files/by-saved-name/{saved_name:path}")
async def download_file_by_saved_name(
	saved_name: str,
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user),
):
	"""
	DB에 저장된 경로(`/uploads/{saved_name}`)의 파일명만으로 다운로드.
	SERVE_UPLOADS_STATIC=false 일 때 프론트는 이 경로로 연결합니다.
	"""
	safe = os.path.basename(saved_name.strip().replace("\\", "/"))
	if not safe or ".." in saved_name:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="잘못된 파일명입니다.")
	row = db.query(UploadedFile).filter(UploadedFile.saved_name == safe).first()
	if not row:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="파일을 찾을 수 없습니다.")
	service.assert_user_may_download_uploaded_file(db, current_user, row)
	return _file_response_for_row(row)


@router.get("/download/{file_id}")
async def download_file_legacy_path(
	file_id: int,
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user),
):
	"""`/files/{file_id}` 와 동일. 구 경로·북마크용 (`/api/common/download/1`)."""
	row = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
	if not row:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="파일을 찾을 수 없습니다.")
	service.assert_user_may_download_uploaded_file(db, current_user, row)
	return _file_response_for_row(row)


@router.get("/files/{file_id}")
async def download_file(
	file_id: int,
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user),
):
	"""
	로그인된 사용자만 파일 ID로 다운로드 (운영에서 SERVE_UPLOADS_STATIC=false 일 때 사용).
	직접 /uploads 정적 노출을 끈 경우 프론트는 이 엔드포인트로 전환할 수 있습니다.
	"""
	row = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
	if not row:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="파일을 찾을 수 없습니다.")
	service.assert_user_may_download_uploaded_file(db, current_user, row)
	return _file_response_for_row(row)


@router.post("/upload", response_model=List[FileUploadResponse])
async def upload_files(
	files: List[UploadFile] = File(...),
	db: Session = Depends(get_db),
	_current_user: dict = Depends(get_current_user),
):
	"""
	공통 파일 업로드 API
	- 확장자 검증 및 용량(50MB) 제한 적용
	- 검증 통과 시 디스크 및 DB에 파일 정보 저장
	"""
	try:
		for file in files:
			ext = os.path.splitext(file.filename)[1].lower()
			
			# 1. 파일 확장자 검증
			if ext not in ALLOWED_EXTENSIONS:
				raise HTTPException(
					status_code=status.HTTP_400_BAD_REQUEST, 
					detail=f"허용되지 않는 파일 형식입니다. (허용: {', '.join(ALLOWED_EXTENSIONS)})"
				)
			
			# 2. 파일 용량 검증
			file.file.seek(0, 2)
			file_size = file.file.tell()
			file.file.seek(0) # 커서를 다시 맨 앞으로 되돌림 (저장할 때 문제없도록)
			
			if file_size > MAX_FILE_SIZE:
				raise HTTPException(
					status_code=status.HTTP_400_BAD_REQUEST, 
					detail="파일 크기는 50MB를 초과할 수 없습니다."
				)
				
		# 3. 서비스 계층 호출 (실제 저장 로직)
		return await service.save_files_to_db_and_disk(db, files)
		
	except HTTPException:
		# 우리가 위에서 직접 발생시킨 에러는 그대로 통과
		raise 
	except Exception:
		# 예상치 못한 에러가 나면 DB 롤백 후 500 에러 반환
		db.rollback()
		logger.exception("Failed to upload files")
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
			detail="파일 업로드 중 서버 오류가 발생했습니다."
		)