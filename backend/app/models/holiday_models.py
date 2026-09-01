from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base


class Holiday(Base):
	__tablename__ = "holidays"
	__table_args__ = (
		UniqueConstraint("tenant_id", "holiday_date", name="uq_holidays_tenant_date"),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	tenant_id: Mapped[int] = mapped_column(
		Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
	)
	holiday_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
	holiday_name: Mapped[str] = mapped_column(String(50), nullable=False)
	is_official: Mapped[bool] = mapped_column(Boolean, default=True)
	description: Mapped[str | None] = mapped_column(String(200), nullable=True)
