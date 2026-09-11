from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session
from api.deps import tenant_id_from_user
from db.session import get_db
from schemas.expense_schemas import ExpenseAction, ExpenseEdit, ExpenseStatus
from services import expense_service as service
from services.auth_service import get_current_user_for_tenant, require_user_login_id

router = APIRouter()


@router.get("")
def list_expenses(status: ExpenseStatus | None = None, skip: int = Query(0, ge=0),
                  limit: int = Query(20, ge=1, le=100),
                  db: Session = Depends(get_db), user: dict = Depends(get_current_user_for_tenant)):
    query = service.scoped(db, tenant_id_from_user(user), require_user_login_id(user))
    if status:
        query = query.filter(service.ExpenseReport.status == status)
    return {"total": query.count(), "items": [service.serialize(r) for r in
        query.order_by(service.ExpenseReport.id.desc()).offset(skip).limit(limit).all()]}


@router.get("/{report_id}")
def get_expense(report_id: int, db: Session = Depends(get_db),
                user: dict = Depends(get_current_user_for_tenant)):
    return service.detail(db, service.get(db, tenant_id_from_user(user), report_id, require_user_login_id(user)))


@router.post("")
def create_expense(db: Session = Depends(get_db), user: dict = Depends(get_current_user_for_tenant)):
    return service.create(db, tenant_id_from_user(user), require_user_login_id(user))


@router.put("/{report_id}")
def edit_expense(report_id: int, payload: ExpenseEdit, db: Session = Depends(get_db),
                 user: dict = Depends(get_current_user_for_tenant)):
    row = service.get(db, tenant_id_from_user(user), report_id, require_user_login_id(user))
    return service.edit(db, row, payload)


@router.post("/{report_id}/receipt")
async def receipt(report_id: int, file: UploadFile = File(...), version: int = Form(..., ge=1),
                  db: Session = Depends(get_db), user: dict = Depends(get_current_user_for_tenant)):
    row = service.get(db, tenant_id_from_user(user), report_id, require_user_login_id(user))
    return await service.upload_receipt(db, row, file, version)


@router.post("/{report_id}/{action}")
def act(report_id: int, action: str, payload: ExpenseAction, db: Session = Depends(get_db),
        user: dict = Depends(get_current_user_for_tenant)):
    row = service.get(db, tenant_id_from_user(user), report_id, require_user_login_id(user))
    return service.transition(db, row, action, payload, require_user_login_id(user), admin=False)
