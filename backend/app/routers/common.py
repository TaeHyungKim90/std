from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session
from typing import List
from db.session import get_db
from controllers import common_controller
from schemas.common_schemas import FileUploadResponse

router = APIRouter()

@router.post("/upload", response_model=List[FileUploadResponse])
async def upload_files(files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    # DB 세션과 파일을 컨트롤러로 전달
    return await common_controller.upload_files(db, files)