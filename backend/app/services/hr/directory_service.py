"""직원 연락처·조직도 서비스."""

from __future__ import annotations

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from models.auth_models import User
from models.system_models import Department
from schemas.hr.directory_schemas import (
	DirectoryDepartmentItem,
	DirectoryListResponse,
	DirectoryOrgDepartment,
	DirectoryOrgResponse,
	DirectoryUserResponse,
)
from services.tenant_scope import departments_in_tenant, directory_users_in_tenant


def _active_directory_query(db: Session, tenant_id: int):
	return (
		directory_users_in_tenant(db, tenant_id)
		.filter(User.approval_status == "approved")
		.filter(User.resignation_date.is_(None))
		.options(
			joinedload(User.department),
			joinedload(User.position),
			joinedload(User.avatar_setting),
		)
	)


def _to_directory_user(user: User) -> DirectoryUserResponse:
	address = None
	if bool(getattr(user, "share_address_in_directory", True)):
		raw = (user.address or "").strip()
		address = raw or None
	return DirectoryUserResponse(
		id=user.id,
		user_name=user.user_name,
		user_nickname=user.user_nickname,
		user_phone_number=user.user_phone_number,
		address=address,
		department_id=user.department_id,
		position_id=user.position_id,
		department_name=user.department_name,
		position_name=user.position_name,
		user_profile_image_url=user.user_profile_image_url,
		avatar_zoom=user.avatar_zoom,
		avatar_offset_x=user.avatar_offset_x,
		avatar_offset_y=user.avatar_offset_y,
	)


def _sort_key_member(u: DirectoryUserResponse):
	return (
		(u.position_name or "").casefold(),
		(u.user_name or "").casefold(),
		u.id,
	)


def list_directory(
	db: Session,
	tenant_id: int,
	*,
	q: str | None = None,
	department_id: int | None = None,
) -> DirectoryListResponse:
	query = _active_directory_query(db, tenant_id)
	if department_id is not None:
		query = query.filter(User.department_id == department_id)
	term = (q or "").strip()
	if term:
		like = f"%{term}%"
		query = query.filter(
			or_(
				User.user_name.ilike(like),
				User.user_nickname.ilike(like),
				User.user_phone_number.ilike(like),
			)
		)
	users = query.order_by(User.user_name.asc(), User.id.asc()).all()
	return DirectoryListResponse(items=[_to_directory_user(u) for u in users])


def list_org(db: Session, tenant_id: int) -> DirectoryOrgResponse:
	users = _active_directory_query(db, tenant_id).all()
	members = [_to_directory_user(u) for u in users]

	depts = (
		departments_in_tenant(db, tenant_id)
		.order_by(Department.department_name.asc(), Department.id.asc())
		.all()
	)
	by_dept: dict[int, list[DirectoryUserResponse]] = {d.id: [] for d in depts}
	unassigned: list[DirectoryUserResponse] = []
	for m in members:
		if m.department_id is not None and m.department_id in by_dept:
			by_dept[m.department_id].append(m)
		else:
			unassigned.append(m)

	departments = []
	for d in depts:
		group = sorted(by_dept.get(d.id, []), key=_sort_key_member)
		departments.append(
			DirectoryOrgDepartment(
				id=d.id,
				department_name=d.department_name,
				members=group,
			)
		)
	unassigned_sorted = sorted(unassigned, key=_sort_key_member)
	return DirectoryOrgResponse(departments=departments, unassigned=unassigned_sorted)


def list_departments(db: Session, tenant_id: int) -> list[DirectoryDepartmentItem]:
	rows = (
		departments_in_tenant(db, tenant_id)
		.order_by(Department.department_name.asc(), Department.id.asc())
		.all()
	)
	return [DirectoryDepartmentItem.model_validate(r) for r in rows]
