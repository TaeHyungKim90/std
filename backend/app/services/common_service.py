import os
import shutil
import uuid
from sqlalchemy.orm import Session
from typing import List
from fastapi import UploadFile
from models.common_models import UploadedFile

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "..", "..", "static", "uploads"))

async def save_files_to_db_and_disk(db: Session, files: List[UploadFile]):
	if not os.path.exists(UPLOAD_DIR):
		os.makedirs(UPLOAD_DIR)

	saved_files_info = []

	for file in files:
		# 저장 파일명은 원본명을 넣지 않고 UUID만 사용 (경로 추측·직링크 노출 완화)
		_, ext = os.path.splitext(file.filename or "")
		ext = ext.lower() if ext else ""
		saved_name = f"{uuid.uuid4().hex}{ext}"
		full_path = os.path.join(UPLOAD_DIR, saved_name)

		# 파일 크기 계산
		file.file.seek(0, 2)
		file_size = file.file.tell()
		file.file.seek(0) 

		# 디스크에 저장
		with open(full_path, "wb") as buffer:
			shutil.copyfileobj(file.file, buffer)

		# DB 모델 생성
		db_file = UploadedFile(
			original_name=file.filename,
			saved_name=saved_name,
			file_path=f"/uploads/{saved_name}",
			file_size=file_size,
			content_type=file.content_type
		)
		db.add(db_file)
		saved_files_info.append(db_file)

	# 모든 파일 DB 기록을 한 번에 커밋
	db.commit()

	# 방금 저장된 객체들의 ID 등 최신 상태 갱신
	for db_file in saved_files_info:
		db.refresh(db_file)

	return saved_files_info