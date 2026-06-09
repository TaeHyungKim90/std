from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Date, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base


class Holiday(Base):
	__tablename__ = "holidays"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	holiday_date: Mapped[date] = mapped_column(Date, unique=True, nullable=False, index=True)
	holiday_name: Mapped[str] = mapped_column(String(50), nullable=False)
	is_official: Mapped[bool] = mapped_column(Boolean, default=True)
	description: Mapped[str | None] = mapped_column(String(200), nullable=True)
