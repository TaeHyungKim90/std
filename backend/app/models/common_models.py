from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base
from utils.seoul_time import now_seoul_naive


class UploadedFile(Base):
	__tablename__ = "uploaded_files"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	original_name: Mapped[str] = mapped_column(String(255), nullable=False)
	saved_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
	file_path: Mapped[str] = mapped_column(String(500), nullable=False)
	file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
	content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)


class AuditLog(Base):
	__tablename__ = "audit_logs"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	admin_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
	target_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
	action: Mapped[str] = mapped_column(String(100), nullable=False)
	endpoint: Mapped[str] = mapped_column(String(300), nullable=False)
	ip_address: Mapped[str | None] = mapped_column(String(100), nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)
