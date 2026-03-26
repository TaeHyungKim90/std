from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from db.session import get_db
from services.auth_service import get_current_user
from models.auth_models import User
from schemas.message_schemas import MessageCreate, MessageResponse
from services import message_service

router = APIRouter()

@router.post("/", response_model=MessageResponse)
def send_message(msg_data: MessageCreate,db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):
    """새로운 메시지 발송 (급여명세서 등)"""
    # 💡 필요시 여기서 current_user.role 검사 (admin/hr만 보낼 수 있게)
    return message_service.send_message(db, current_user["id"], msg_data)

@router.get("/inbox", response_model=List[MessageResponse])
def get_inbox(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """내 수신함 조회"""
    return message_service.get_my_inbox(db, current_user["id"])

@router.get("/outbox", response_model=List[MessageResponse])
def get_outbox(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """내 발신함 조회 (관리자/HR용)"""
    return message_service.get_my_outbox(db, current_user["id"])

@router.put("/{message_id}/read", response_model=MessageResponse)
def read_message(message_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """메시지 읽음 처리"""
    return message_service.mark_as_read(db, message_id, current_user["id"])

@router.delete("/{message_id}")
def delete_message(message_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """메시지 삭제"""
    return message_service.delete_message(db, message_id, current_user["id"])