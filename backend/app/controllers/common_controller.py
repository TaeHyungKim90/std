import os
from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session
from typing import List
from app.services import common_service
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx"}
MAX_FILE_SIZE = 50 * 1024 * 1024

async def upload_files(db: Session, files: List[UploadFile]):
    try:
        for file in files:
            ext = os.path.splitext(file.filename)[1].lower()
            # 파일 확장자 검증
            if ext not in ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=400, 
                    detail=f"허용되지 않는 파일 형식입니다. (허용: {', '.join(ALLOWED_EXTENSIONS)})"
                )
            # 파일 용량 검증
            file.file.seek(0, 2)
            file_size = file.file.tell()
            file.file.seek(0)
            if file_size > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=400, 
                    detail="파일 크기는 10MB를 초과할 수 없습니다."
                )
        # 서비스 계층 호출
        return await common_service.save_files_to_db_and_disk(db, files)
    except HTTPException:
        raise 
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"파일 업로드 실패: {str(e)}")