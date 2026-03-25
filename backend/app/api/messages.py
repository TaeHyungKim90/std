from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from db.session import get_db
from services import message_service
from services.auth_service import get_current_admin # 관리자 문지기

router = APIRouter(tags=["Admin Message"])

@router.post("")
async def send_message(
    title: str = Form(...),
    content: str = Form(None),
    receiver_id: Optional[int] = Form(None),
    message_type: str = Form("individual"),
    files: List[UploadFile] = File([]),
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    return await message_service.create_new_message(
        db, title, content, current_admin.id, receiver_id, message_type, files
    )