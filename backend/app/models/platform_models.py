from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base
from utils.seoul_time import now_seoul_naive


class PlatformAdmin(Base):
	"""SaaS 플랫폼 운영자 — 테넌트와 무관한 전역 관리 계정."""

	__tablename__ = "platform_admins"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	login_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
	password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
	name: Mapped[str] = mapped_column(String(100), nullable=False)
	is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)
