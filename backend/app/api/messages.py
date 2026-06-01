from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.deps import tenant_id_from_user
from db.session import get_db
from services.auth_service import get_current_user_for_tenant
from schemas.message_schemas import MessageCreate, MessageResponse, MessageListPage
from services import message_service

router = APIRouter()


@router.post("/", response_model=MessageResponse)
def send_message(
	msg_data: MessageCreate,
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	tid = tenant_id_from_user(current_user)
	return message_service.send_message(db, tid, current_user["id"], msg_data)


@router.get("/inbox", response_model=MessageListPage)
def get_inbox(
	skip: int = Query(0, ge=0),
	limit: int = Query(20, ge=1, le=100),
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	tid = tenant_id_from_user(current_user)
	return message_service.get_my_inbox(db, tid, current_user["id"], skip=skip, limit=limit)


@router.get("/outbox", response_model=MessageListPage)
def get_outbox(
	skip: int = Query(0, ge=0),
	limit: int = Query(20, ge=1, le=100),
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	tid = tenant_id_from_user(current_user)
	return message_service.get_my_outbox(db, tid, current_user["id"], skip=skip, limit=limit)


@router.put("/{message_id}/read", response_model=MessageResponse)
def read_message(
	message_id: int,
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	tid = tenant_id_from_user(current_user)
	return message_service.mark_as_read(db, tid, message_id, current_user["id"])


@router.delete("/{message_id}")
def delete_message(
	message_id: int,
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	tid = tenant_id_from_user(current_user)
	return message_service.delete_message(db, tid, message_id, current_user["id"])
