from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, ForeignKeyConstraint, Integer, JSON, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base
from utils.seoul_time import now_seoul_naive


class ExpenseReport(Base):
    __tablename__ = "expense_reports"
    __table_args__ = (
        UniqueConstraint("tenant_id", "report_no"),
        UniqueConstraint("tenant_id", "id"),
        ForeignKeyConstraint(["tenant_id", "user_id"], ["users.tenant_id", "users.user_login_id"]),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(50), index=True)
    report_no: Mapped[str] = mapped_column(String(50))
    department: Mapped[str | None] = mapped_column(String(100))
    expense_date: Mapped[date | None] = mapped_column(Date)
    expense_type: Mapped[str | None] = mapped_column(String(50))
    account_code: Mapped[str | None] = mapped_column(String(50))
    merchant_name: Mapped[str | None] = mapped_column(String(200))
    business_number: Mapped[str | None] = mapped_column(String(20))
    supply_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    payment_method: Mapped[str | None] = mapped_column(String(50))
    masked_card_number: Mapped[str | None] = mapped_column(String(8))
    purpose: Mapped[str | None] = mapped_column(String(2000))
    memo: Mapped[str | None] = mapped_column(String(2000))
    receipt_file_id: Mapped[int | None] = mapped_column(ForeignKey("uploaded_files.id"))
    status: Mapped[str] = mapped_column(String(20), default="DRAFT", index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    requested_at: Mapped[datetime | None] = mapped_column(DateTime)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime)
    accounted_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(default=now_seoul_naive)
    updated_at: Mapped[datetime] = mapped_column(default=now_seoul_naive, onupdate=now_seoul_naive)
    __mapper_args__ = {"version_id_col": version}


class ExpenseOcrResult(Base):
    __tablename__ = "expense_ocr_results"
    __table_args__ = (ForeignKeyConstraint(["tenant_id", "expense_report_id"], ["expense_reports.tenant_id", "expense_reports.id"]),)
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(Integer, index=True)
    expense_report_id: Mapped[int] = mapped_column(Integer, index=True)
    receipt_file_id: Mapped[int] = mapped_column(ForeignKey("uploaded_files.id"), index=True)
    ocr_provider: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20))
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(default=now_seoul_naive)


class ExpenseApprovalHistory(Base):
    __tablename__ = "expense_approval_history"
    __table_args__ = (ForeignKeyConstraint(["tenant_id", "expense_report_id"], ["expense_reports.tenant_id", "expense_reports.id"]),)
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(Integer, index=True)
    expense_report_id: Mapped[int] = mapped_column(Integer, index=True)
    from_status: Mapped[str] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20))
    action: Mapped[str] = mapped_column(String(30))
    actor_id: Mapped[str] = mapped_column(String(50))
    comment: Mapped[str | None] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(default=now_seoul_naive)
