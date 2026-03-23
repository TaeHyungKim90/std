import os
import shutil
from datetime import datetime
from sqlalchemy.orm import Session
from typing import List
from fastapi import UploadFile
from models.common_models import UploadedFile

async def save_files_to_db_and_disk(db: Session, files: List[UploadFile]):
    # 저장 디렉토리 설정
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    UPLOAD_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "..", "..", "static", "uploads"))
    
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)

    saved_files_info = []

    for file in files:
        # 파일명 생성 (밀리초까지 넣어서 중복 완전 방지)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        saved_name = f"{timestamp}_{file.filename}"
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