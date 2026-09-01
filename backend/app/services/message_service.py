from typing import Any

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from fastapi import HTTPException
from models.auth_models import User
from models.message_models import Message, MessageAttachment, MessageReadReceipt
from schemas.message_schemas import MessageCreate, MessageResponse
from services.tenant_scope import require_user_by_pk, users_in_tenant


def _tenant_user_ids_subquery(db: Session, tenant_id: int):
	return db.query(User.id).filter(User.tenant_id == tenant_id).scalar_subquery()


def send_message(db: Session, tenant_id: int, sender_id: int, msg_data: MessageCreate):
	require_user_by_pk(db, tenant_id, sender_id)

	if not msg_data.is_global and not msg_data.receiver_id:
		raise HTTPException(status_code=400, detail="개별 메시지는 수신자를 지정해야 합니다.")

	if not msg_data.is_global and msg_data.receiver_id:
		require_user_by_pk(db, tenant_id, msg_data.receiver_id)

	new_msg = Message(
		title=msg_data.title,
		content=msg_data.content,
		message_type=msg_data.message_type,
		is_global=msg_data.is_global,
		sender_id=sender_id,
		receiver_id=msg_data.receiver_id if not msg_data.is_global else None,
	)
	db.add(new_msg)
	db.flush()

	if msg_data.file_ids:
		for f_id in msg_data.file_ids:
			attachment = MessageAttachment(message_id=new_msg.id, file_id=f_id)
			db.add(attachment)

	db.commit()
	db.refresh(new_msg)
	return new_msg


def _message_to_response(msg: Message, effective_is_read: bool) -> MessageResponse:
	return MessageResponse.model_validate(msg, from_attributes=True).model_copy(
		update={"is_read": effective_is_read}
	)


def get_my_inbox(db: Session, tenant_id: int, user_id: int, skip: int = 0, limit: int = 20):
	require_user_by_pk(db, tenant_id, user_id)
	tenant_users = _tenant_user_ids_subquery(db, tenant_id)

	base = (
		db.query(Message)
		.options(
			joinedload(Message.sender),
			joinedload(Message.receiver),
			joinedload(Message.attachments).joinedload(MessageAttachment.file_info),
		)
		.filter(Message.sender_id.in_(tenant_users))
		.filter(or_(Message.receiver_id == user_id, Message.is_global == True))
		.order_by(Message.created_at.desc())
	)

	total = base.count()
	messages = base.offset(skip).limit(limit).all()

	global_ids = [m.id for m in messages if m.is_global]
	receipt_ids: set[int] = set()
	if global_ids:
		rows = (
			db.query(MessageReadReceipt.message_id)
			.filter(
				MessageReadReceipt.user_id == user_id,
				MessageReadReceipt.message_id.in_(global_ids),
			)
			.all()
		)
		receipt_ids = {r[0] for r in rows}

	out: list[MessageResponse] = []
	for m in messages:
		mm: Any = m
		if mm.is_global:
			effective = mm.id in receipt_ids
		else:
			effective = bool(mm.is_read)
		out.append(_message_to_response(m, effective))
	return {"items": out, "total": total}


def get_my_outbox(db: Session, tenant_id: int, sender_id: int, skip: int = 0, limit: int = 20):
	require_user_by_pk(db, tenant_id, sender_id)
	base = (
		db.query(Message)
		.options(
			joinedload(Message.sender),
			joinedload(Message.receiver),
			joinedload(Message.attachments).joinedload(MessageAttachment.file_info),
		)
		.filter(Message.sender_id == sender_id)
		.order_by(Message.created_at.desc())
	)

	total = base.count()
	items = base.offset(skip).limit(limit).all()
	out = [MessageResponse.model_validate(m, from_attributes=True) for m in items]
	return {"items": out, "total": total}


def mark_as_read(db: Session, tenant_id: int, message_id: int, user_id: int):
	require_user_by_pk(db, tenant_id, user_id)
	tenant_users = _tenant_user_ids_subquery(db, tenant_id)
	msg = (
		db.query(Message)
		.filter(Message.id == message_id, Message.sender_id.in_(tenant_users))
		.first()
	)
	if not msg:
		raise HTTPException(status_code=404, detail="메시지를 찾을 수 없습니다.")

	if not msg.is_global and msg.receiver_id != user_id:
		raise HTTPException(status_code=403, detail="읽을 권한이 없습니다.")

	if msg.is_global:
		existing = (
			db.query(MessageReadReceipt)
			.filter(
				MessageReadReceipt.message_id == message_id,
				MessageReadReceipt.user_id == user_id,
			)
			.first()
		)
		if not existing:
			db.add(MessageReadReceipt(message_id=message_id, user_id=user_id))
			db.commit()
		db.refresh(msg)
		return _message_to_response(msg, True)

	if not msg.is_read:
		msg.is_read = True
		db.commit()
		db.refresh(msg)
	return MessageResponse.model_validate(msg, from_attributes=True)


def delete_message(db: Session, tenant_id: int, message_id: int, user_id: int):
	require_user_by_pk(db, tenant_id, user_id)
	tenant_users = _tenant_user_ids_subquery(db, tenant_id)
	msg = (
		db.query(Message)
		.filter(Message.id == message_id, Message.sender_id.in_(tenant_users))
		.first()
	)
	if not msg:
		raise HTTPException(status_code=404, detail="메시지를 찾을 수 없습니다.")

	if msg.sender_id != user_id and msg.receiver_id != user_id:
		raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")

	db.delete(msg)
	db.commit()
	return {"detail": "메시지가 삭제되었습니다."}
