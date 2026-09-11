import logging
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm.exc import StaleDataError

from models.auth_models import User
from models.common_models import UploadedFile
from models.expense_models import ExpenseReport, ExpenseOcrResult, ExpenseApprovalHistory
from services import receipt_ocr_service
from utils.seoul_time import now_seoul_naive

PRIVATE_RECEIPT_DIR = Path(__file__).resolve().parents[2] / "private_receipts"
MAX_RECEIPT_SIZE = 10 * 1024 * 1024
TRANSITIONS = {
    "submit": ({"DRAFT"}, "REQUESTED", False),
    "cancel": ({"DRAFT"}, "CANCELED", False),
    "withdraw": ({"REQUESTED"}, "WITHDRAWN", False),
    "reopen": ({"REJECTED", "WITHDRAWN"}, "DRAFT", False),
    "approve": ({"REQUESTED"}, "APPROVED", True),
    "reject": ({"REQUESTED"}, "REJECTED", True),
    "account": ({"APPROVED"}, "ACCOUNTED", True),
}


def commit(db):
    try:
        db.commit()
    except StaleDataError:
        db.rollback()
        raise HTTPException(409, "다른 요청으로 변경되었습니다. 새로고침해 주세요.")


def scoped(db, tenant_id, user_id=None):
    query = db.query(ExpenseReport).filter(ExpenseReport.tenant_id == tenant_id)
    return query.filter(ExpenseReport.user_id == user_id) if user_id is not None else query


def get(db, tenant_id, report_id, user_id=None):
    row = scoped(db, tenant_id, user_id).filter(ExpenseReport.id == report_id).first()
    if row is None:
        raise HTTPException(404, "지출결의서를 찾을 수 없습니다.")
    return row


def serialize(row):
    # Explicit decimal strings avoid floating-point JSON conversion.
    from decimal import Decimal
    return {c.name: str(v) if isinstance(v := getattr(row, c.name), Decimal) else v for c in row.__table__.columns}


def detail(db, row):
    result = serialize(row)
    result["history"] = [serialize(h) for h in db.query(ExpenseApprovalHistory).filter(
        ExpenseApprovalHistory.tenant_id == row.tenant_id, ExpenseApprovalHistory.expense_report_id == row.id
    ).order_by(ExpenseApprovalHistory.id).all()]
    ocr = db.query(ExpenseOcrResult).filter(ExpenseOcrResult.tenant_id == row.tenant_id,
        ExpenseOcrResult.expense_report_id == row.id).order_by(ExpenseOcrResult.id.desc()).first()
    result["ocr"] = serialize(ocr) if ocr else None
    return result


def create(db, tenant_id, user_id):
    user = db.query(User).filter(User.tenant_id == tenant_id, User.user_login_id == user_id).one()
    row = ExpenseReport(tenant_id=tenant_id, user_id=user_id,
        report_no=f"EXP-{uuid4().hex}",
        department=user.department.department_name if user.department else None)
    db.add(row)
    commit(db)
    return detail(db, row)


def check_version(row, version):
    if row.version != version:
        raise HTTPException(409, "다른 요청으로 변경되었습니다. 새로고침해 주세요.")


def require_draft(row):
    if row.status != "DRAFT":
        raise HTTPException(400, "임시저장 상태에서만 수정할 수 있습니다.")


def edit(db, row, payload):
    check_version(row, payload.version)
    require_draft(row)
    for key, value in payload.model_dump(exclude={"version"}, exclude_unset=True).items():
        setattr(row, key, value)
    row.updated_at = now_seoul_naive()
    commit(db)
    return detail(db, row)


def transition(db, row, action, payload, actor_id, admin=False):
    check_version(row, payload.version)
    rule = TRANSITIONS.get(action)
    if not rule or rule[2] != admin or row.status not in rule[0]:
        raise HTTPException(400, "허용되지 않는 상태 변경입니다.")
    if not admin and row.user_id != actor_id:
        raise HTTPException(403, "본인의 결의서만 변경할 수 있습니다.")
    if action == "reject" and not payload.comment:
        raise HTTPException(400, "반려 사유를 입력해 주세요.")
    if action == "submit":
        if not payload.reviewed:
            raise HTTPException(400, "영수증과 입력 내용을 확인해 주세요.")
        if not all([row.expense_date, row.expense_type, row.account_code, row.merchant_name,
                    row.payment_method, row.purpose]):
            raise HTTPException(400, "필수 지출 정보를 입력해 주세요.")
        if row.total_amount <= 0 or row.supply_amount + row.vat_amount != row.total_amount:
            raise HTTPException(400, "합계는 공급가액과 부가세의 합이며 0보다 커야 합니다.")
    previous = row.status
    row.status = rule[1]
    stamp = {"submit": "requested_at", "approve": "approved_at", "reject": "rejected_at", "account": "accounted_at"}.get(action)
    if stamp:
        setattr(row, stamp, now_seoul_naive())
    if action == "reopen":
        row.requested_at = row.approved_at = row.rejected_at = None
    db.add(ExpenseApprovalHistory(tenant_id=row.tenant_id, expense_report_id=row.id,
        from_status=previous, to_status=row.status, action=action, actor_id=actor_id, comment=payload.comment))
    commit(db)
    return detail(db, row)


async def upload_receipt(db, row, file: UploadFile, version: int):
    check_version(row, version)
    require_draft(row)
    ext = Path(file.filename or "").suffix.lower()
    expected = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}.get(ext)
    if not expected or file.content_type != expected:
        raise HTTPException(400, "JPG 또는 PNG 이미지를 업로드해 주세요.")
    data = await file.read(MAX_RECEIPT_SIZE + 1)
    if not data or len(data) > MAX_RECEIPT_SIZE:
        raise HTTPException(400, "비어 있지 않은 10MB 이하 파일이 필요합니다.")
    if not (data.startswith(b"\x89PNG\r\n\x1a\n") if expected == "image/png" else data.startswith(b"\xff\xd8\xff")):
        raise HTTPException(400, "이미지 파일 형식이 일치하지 않습니다.")
    name = f"{uuid4().hex}{ext}"
    PRIVATE_RECEIPT_DIR.mkdir(parents=True, exist_ok=True)
    path = PRIVATE_RECEIPT_DIR / name
    try:
        path.write_bytes(data)
        attachment = UploadedFile(original_name=Path((file.filename or "receipt").replace("\\", "/")).name[:255],
            saved_name=name, file_path=f"expense://{name}", file_size=len(data), content_type=expected)
        db.add(attachment)
        db.flush()
        row.receipt_file_id = attachment.id
        row.updated_at = now_seoul_naive()
        try:
            extracted = receipt_ocr_service.analyze(data, expected)
            ocr_status = "SUCCEEDED"
        except Exception:
            # No provider payload or receipt contents in logs/errors.
            logging.getLogger(__name__).warning("Receipt OCR failed for report %s", row.id)
            extracted, ocr_status = {}, "FAILED"
        from core.config import settings
        db.add(ExpenseOcrResult(tenant_id=row.tenant_id, expense_report_id=row.id,
            receipt_file_id=attachment.id, ocr_provider=settings.OCR_PROVIDER,
            status=ocr_status, data=extracted))
        commit(db)
    except Exception:
        db.rollback()
        path.unlink(missing_ok=True)
        raise
    return detail(db, row)


def assert_receipt_access(db, current_user, uploaded_row):
    from api.deps import tenant_id_from_user
    from services.auth_service import require_user_login_id
    tenant_id = tenant_id_from_user(current_user)
    user_id = require_user_login_id(current_user)
    # Historical/replaced receipts remain protected and linked through OCR records.
    query = scoped(db, tenant_id, None if current_user.get("role") == "admin" else user_id)
    linked = query.join(ExpenseOcrResult, (ExpenseOcrResult.expense_report_id == ExpenseReport.id)
        & (ExpenseOcrResult.tenant_id == ExpenseReport.tenant_id)).filter(
        ExpenseOcrResult.receipt_file_id == uploaded_row.id).first()
    if linked is None:
        raise HTTPException(403, "이 영수증에 접근할 권한이 없습니다.")
