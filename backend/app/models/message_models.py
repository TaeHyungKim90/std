from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base
from utils.seoul_time import now_seoul_naive

if TYPE_CHECKING:
	from models.auth_models import User
	from models.common_models import UploadedFile


class MessageType(enum.Enum):
	INDIVIDUAL = "individual"
	GLOBAL = "global"


class Message(Base):
	__tablename__ = "messages"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	title: Mapped[str] = mapped_column(String(200), nullable=False)
	content: Mapped[str | None] = mapped_column(Text, nullable=True)
	message_type: Mapped[MessageType | None] = mapped_column(Enum(MessageType), default=MessageType.INDIVIDUAL)
	is_global: Mapped[bool | None] = mapped_column(Boolean, default=False)
	sender_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
	receiver_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)
	is_read: Mapped[bool | None] = mapped_column(Boolean, default=False)

	sender: Mapped[User] = relationship("User", foreign_keys=[sender_id], backref="sent_messages")
	receiver: Mapped[User | None] = relationship("User", foreign_keys=[receiver_id], backref="received_messages")
	attachments: Mapped[list[MessageAttachment]] = relationship(
		"MessageAttachment", back_populates="message", cascade="all, delete-orphan"
	)
	read_receipts: Mapped[list[MessageReadReceipt]] = relationship(
		"MessageReadReceipt", back_populates="message", cascade="all, delete-orphan"
	)


class MessageReadReceipt(Base):
	__tablename__ = "message_read_receipts"
	__table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_message_read_user"),)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
	message_id: Mapped[int] = mapped_column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
	user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
	read_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)

	message: Mapped[Message] = relationship("Message", back_populates="read_receipts")
	user: Mapped[User] = relationship("User", foreign_keys=[user_id])


class MessageAttachment(Base):
	__tablename__ = "message_attachments"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	message_id: Mapped[int] = mapped_column(Integer, ForeignKey("messages.id"), nullable=False)
	file_id: Mapped[int] = mapped_column(Integer, ForeignKey("uploaded_files.id"), nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)

	message: Mapped[Message] = relationship("Message", back_populates="attachments")
	file_info: Mapped[UploadedFile] = relationship("UploadedFile")
