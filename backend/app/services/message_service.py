from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from fastapi import HTTPException
from models.message_models import Message, MessageAttachment
from schemas.message_schemas import MessageCreate

def send_message(db: Session, sender_id: int, msg_data: MessageCreate):
    # 1. 수신자 검증 (전체 공지가 아닌데 수신자가 없으면 에러)
    if not msg_data.is_global and not msg_data.receiver_id:
        raise HTTPException(status_code=400, detail="개별 메시지는 수신자를 지정해야 합니다.")

    # 2. 메시지 본문 생성
    new_msg = Message(
        title=msg_data.title,
        content=msg_data.content,
        message_type=msg_data.message_type,
        is_global=msg_data.is_global,
        sender_id=sender_id,
        receiver_id=msg_data.receiver_id if not msg_data.is_global else None
    )
    db.add(new_msg)
    db.flush() # ID 발급을 위해 flush (commit 전)

    # 3. 첨부파일 연결 (이미 common/upload로 올린 파일 ID 매핑)
    if msg_data.file_ids:
        for f_id in msg_data.file_ids:
            attachment = MessageAttachment(message_id=new_msg.id, file_id=f_id)
            db.add(attachment)
            
    db.commit()
    db.refresh(new_msg)
    return new_msg

def get_my_inbox(db: Session, user_id: int):
    """내 수신함 (나에게 온 메시지 + 전체 공지)"""
    return db.query(Message).options(
        joinedload(Message.sender),
        joinedload(Message.attachments).joinedload(MessageAttachment.file_info)
    ).filter(
        or_(Message.receiver_id == user_id, Message.is_global == True)
    ).order_by(Message.created_at.desc()).all()

def get_my_outbox(db: Session, sender_id: int):
    """내 발신함 (내가 보낸 메시지 - HR/관리자용)"""
    return db.query(Message).options(
        joinedload(Message.attachments).joinedload(MessageAttachment.file_info)
    ).filter(Message.sender_id == sender_id).order_by(Message.created_at.desc()).all()

def mark_as_read(db: Session, message_id: int, user_id: int):
    """메시지 읽음 처리"""
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="메시지를 찾을 수 없습니다.")
        
    # 권한 검사: 내 메시지가 아니면 (전체 공지가 아닌 경우)
    if not msg.is_global and msg.receiver_id != user_id:
        raise HTTPException(status_code=403, detail="읽을 권한이 없습니다.")

    if not msg.is_read:
        msg.is_read = True
        db.commit()
        db.refresh(msg)
    return msg

def delete_message(db: Session, message_id: int, user_id: int):
    """메시지 삭제"""
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="메시지를 찾을 수 없습니다.")
        
    # 발신자 또는 수신자만 삭제 가능
    if msg.sender_id != user_id and msg.receiver_id != user_id:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
        
    db.delete(msg)
    db.commit()
    return {"detail": "메시지가 삭제되었습니다."}