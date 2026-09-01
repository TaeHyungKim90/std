import os
import shutil
import uuid
from sqlalchemy.orm import Session
from typing import List
from fastapi import UploadFile, HTTPException, status
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


def assert_user_may_download_uploaded_file(db: Session, current_user: dict, uploaded_row: UploadedFile) -> None:
	"""관리자는 전체, 프로필 이미지는 본인, 메시지 첨부는 권한 있는 사용자만 허용."""
	from models.auth_models import User
	from models.message_models import MessageAttachment, Message

	if current_user.get("role") == "admin":
		return

	tenant_id = current_user.get("tenantId")
	uid = current_user.get("id")
	if uid is None:
		login_id = current_user.get("userId")
		if login_id:
			user_query = db.query(User).filter(User.user_login_id == login_id)
			if tenant_id is not None:
				user_query = user_query.filter(User.tenant_id == int(tenant_id))
			user = user_query.first()
			uid = user.id if user else None
	if uid is None:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="이 파일에 접근할 권한이 없습니다.")

	saved_name = str(uploaded_row.saved_name or "")
	file_path = str(uploaded_row.file_path or "")
	profile_paths = {path for path in (file_path, f"/uploads/{saved_name}" if saved_name else "") if path}
	if profile_paths:
		profile_query = db.query(User).filter(
			User.id == uid,
			User.user_profile_image_url.in_(profile_paths),
		)
		if tenant_id is not None:
			profile_query = profile_query.filter(User.tenant_id == int(tenant_id))
		if profile_query.first():
			return

	links = db.query(MessageAttachment).filter(MessageAttachment.file_id == uploaded_row.id).all()
	if not links:
		raise HTTPException(
			status_code=status.HTTP_403_FORBIDDEN,
			detail="이 파일에 접근할 권한이 없습니다.",
		)

	is_pdf = str(uploaded_row.content_type or "").lower().startswith("application/pdf") or str(
		uploaded_row.original_name or ""
	).lower().endswith(".pdf")

	for link in links:
		msg = db.query(Message).filter(Message.id == link.message_id).first()
		if not msg:
			continue
		# 테넌트 격리 체크: 메시지 발송자의 테넌트 ID가 현재 유저의 테넌트 ID와 일치하는지 확인
		if msg.sender is None or (tenant_id is not None and msg.sender.tenant_id != int(tenant_id)):
			continue

		if is_pdf:
			if getattr(msg, "is_global", False):
				return
			if msg.receiver_id == uid:
				return
			continue
		if getattr(msg, "is_global", False):
			return
		if msg.receiver_id == uid or msg.sender_id == uid:
			return

	raise HTTPException(
		status_code=status.HTTP_403_FORBIDDEN,
		detail="이 파일에 접근할 권한이 없습니다.",
	)