from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException, status
from typing import List
from models.message_models import Message, MessageAttachment, MessageType
from services.common_service import save_files_to_db_and_disk

# 📩 메시지 발송 (관리자)
async def create_new_message(
    db: Session, 
    title: str, 
    content: str, 
    sender_id: int, 
    receiver_id: int = None, 
    message_type: str = "individual",
    files: List[UploadFile] = []
):
    # 1. 메시지 본문 저장
    new_msg = Message(
        title=title,
        content=content,
        sender_id=sender_id,
        receiver_id=receiver_id,
        message_type=MessageType(message_type),
        is_global=(message_type == "global")
    )
    db.add(new_msg)
    db.flush() # ID 확보

    # 2. 첨부파일 처리 (마스터님의 기존 엔진 활용!)
    if files:
        uploaded_files = await save_files_to_db_and_disk(db, files)
        for db_file in uploaded_files:
            attachment = MessageAttachment(
                message_id=new_msg.id,
                file_id=db_file.id
            )
            db.add(attachment)
    
    db.commit()
    db.refresh(new_msg)
    return new_msg

# 📬 내 메시지 목록 조회 (보안 적용)
def get_my_messages(db: Session, user_id: int):
    # 본인이 수신자이거나, 전체 공지인 것만 가져옴
    return db.query(Message).filter(
        (Message.receiver_id == user_id) | (Message.is_global == True)
    ).order_by(Message.created_at.desc()).all()

# 🔍 메시지 상세 보기 (철저한 보안 검증)
def get_message_detail(db: Session, message_id: int, user_id: int):
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="메시지를 찾을 수 없습니다.")
    
    # 🚨 보안 핵심: 수신자도 아니고 관리자도 아니면 컷!
    if msg.receiver_id != user_id and not msg.is_global:
        # 여기에 관리자 권한 체크 로직을 추가할 수 있습니다.
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    
    # 읽음 처리
    if msg.receiver_id == user_id:
        msg.is_read = True
        db.commit()
        
    return msg