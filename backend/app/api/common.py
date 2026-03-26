import os
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from db.session import get_db
from services import common_service as service
from schemas.common_schemas import FileUploadResponse

# 라우터 설정
router = APIRouter()

# 파일 업로드 정책 설정
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

@router.post("/upload", response_model=List[FileUploadResponse])
async def upload_files(files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
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
            file.file.seek(0)  # 커서를 다시 맨 앞으로 되돌림 (저장할 때 문제없도록)
            
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
    except Exception as e:
        # 예상치 못한 에러가 나면 DB 롤백 후 500 에러 반환
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"파일 업로드 중 오류가 발생했습니다: {str(e)}"
        )