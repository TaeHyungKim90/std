from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

Money = Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=2, allow_inf_nan=False)]
ExpenseStatus = Literal["DRAFT", "REQUESTED", "APPROVED", "REJECTED", "WITHDRAWN", "ACCOUNTED", "CANCELED"]


class ExpenseEdit(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    version: int = Field(ge=1)
    expense_date: date | None = None
    expense_type: str | None = Field(default=None, max_length=50)
    account_code: str | None = Field(default=None, max_length=50)
    merchant_name: str | None = Field(default=None, max_length=200)
    business_number: str | None = Field(default=None, max_length=20)
    supply_amount: Money = Decimal(0)
    vat_amount: Money = Decimal(0)
    total_amount: Money = Decimal(0)
    payment_method: str | None = Field(default=None, max_length=50)
    masked_card_number: str | None = Field(default=None, pattern=r"^\*{4}\d{4}$")
    purpose: str | None = Field(default=None, max_length=2000)
    memo: str | None = Field(default=None, max_length=2000)


class ExpenseAction(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    version: int = Field(ge=1)
    comment: str | None = Field(default=None, max_length=2000)
    reviewed: bool = False
