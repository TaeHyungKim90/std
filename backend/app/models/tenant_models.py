from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base
from utils.seoul_time import now_seoul_naive


class Tenant(Base):
	"""SaaS 테넌트(기업) — URL 경로 slug로 식별 (예: /valuesplay, /naver)."""

	__tablename__ = "tenants"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
	name: Mapped[str] = mapped_column(String(200), nullable=False)
	is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
	logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
	icon_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)
