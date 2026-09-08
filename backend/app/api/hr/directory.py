"""직원 연락처·조직도 API."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.deps import tenant_id_from_user
from db.session import get_db
from schemas.hr import directory_schemas
from services.auth_service import get_current_user_for_tenant
from services.hr import directory_service as service

router = APIRouter()


@router.get("", response_model=directory_schemas.DirectoryListResponse)
def read_directory(
	q: str | None = Query(None, description="이름·닉네임·전화 검색"),
	department_id: int | None = Query(None, description="부서 필터"),
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	"""재직·승인·목록 노출 직원의 연락처 목록."""
	tid = tenant_id_from_user(current_user)
	return service.list_directory(db, tid, q=q, department_id=department_id)


@router.get("/org", response_model=directory_schemas.DirectoryOrgResponse)
def read_directory_org(
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	"""부서별 조직도(평면 그룹) + 미배정."""
	tid = tenant_id_from_user(current_user)
	return service.list_org(db, tid)


@router.get("/departments", response_model=directory_schemas.DirectoryDepartmentListResponse)
def read_directory_departments(
	db: Session = Depends(get_db),
	current_user: dict = Depends(get_current_user_for_tenant),
):
	"""직원용 부서 필터 목록(읽기 전용)."""
	tid = tenant_id_from_user(current_user)
	items = service.list_departments(db, tid)
	return directory_schemas.DirectoryDepartmentListResponse(items=items)
