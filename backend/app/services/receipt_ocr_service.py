"""Providers return suggestions only. Never persist unfiltered provider payloads."""
from typing import Protocol
from pydantic import BaseModel, ConfigDict, Field
from schemas.expense_schemas import ExpenseEdit


class OcrExtraction(ExpenseEdit):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)
    version: int = 1
    confidence: float = Field(default=0, ge=0, le=1)


class ReceiptOcrProvider(Protocol):
    def analyze(self, image_bytes: bytes, content_type: str) -> dict: ...


class MockReceiptOcrProvider:
    def analyze(self, image_bytes: bytes, content_type: str) -> dict:
        return {"merchant_name": "[MOCK] 예시 거래처", "supply_amount": "10000.00",
                "vat_amount": "1000.00", "total_amount": "11000.00", "confidence": 0,
                "masked_card_number": "****1234", "payment_method": "CARD"}


def get_provider() -> ReceiptOcrProvider:
    from core.config import settings
    if settings.OCR_PROVIDER != "mock":
        raise ValueError("Unsupported OCR provider")
    return MockReceiptOcrProvider()


def analyze(image_bytes: bytes, content_type: str) -> dict:
    result = OcrExtraction.model_validate(get_provider().analyze(image_bytes, content_type))
    # Allowlisted fields only; raw text/JSON and full card numbers are never retained.
    return result.model_dump(mode="json", exclude={"version"}, exclude_unset=True)
