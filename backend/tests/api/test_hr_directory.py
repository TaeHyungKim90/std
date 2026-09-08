"""직원 연락처·조직도 API 테스트."""

from datetime import date

from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

import main as app_main
from conftest import TENANT_HEADERS
from core.security import create_access_token, get_password_hash
from db.session import get_db
from models.auth_models import User
from models.system_models import Department, Position
from models.tenant_models import Tenant
from support.memory_db import memory_db_session


SENSITIVE_KEYS = {
	"birth_date",
	"salary_bank_name",
	"salary_account_number",
	"user_login_id",
	"provider_kakao_id",
	"provider_naver_id",
}


def _token_for(user: User, tenant_slug: str) -> str:
	return create_access_token(
		{
			"userId": user.user_login_id,
			"userName": user.user_name,
			"userNickname": user.user_nickname,
			"role": user.role or "user",
			"id": user.id,
			"tenantId": user.tenant_id,
			"tenantSlug": tenant_slug,
		}
	)


def _seed_directory_db(db: Session):
	t_a = db.query(Tenant).filter(Tenant.id == 1).first()
	assert t_a is not None
	t_b = Tenant(slug="otherco", name="Other Co", is_active=True)
	db.add(t_b)
	db.flush()

	dept = Department(tenant_id=t_a.id, department_name="개발팀")
	pos = Position(tenant_id=t_a.id, position_name="사원")
	db.add_all([dept, pos])
	db.flush()
	assert dept.id is not None
	assert pos.id is not None

	pw = get_password_hash("pass-1234")
	viewer = User(
		tenant_id=t_a.id,
		user_login_id="dir_viewer",
		user_password=pw,
		user_name="조회자",
		user_nickname="뷰어",
		role="user",
		approval_status="approved",
		user_phone_number="01011112222",
		address="서울 비공개주소",
		share_address_in_directory=False,
		department_id=dept.id,
		position_id=pos.id,
	)
	shared = User(
		tenant_id=t_a.id,
		user_login_id="dir_shared",
		user_password=pw,
		user_name="공개동료",
		user_nickname="공개닉",
		role="user",
		approval_status="approved",
		user_phone_number="01033334444",
		address="서울 공개주소 1",
		share_address_in_directory=True,
		birth_date="1990-01-01",
		salary_bank_name="국민",
		salary_account_number="123",
		department_id=dept.id,
		position_id=pos.id,
	)
	hidden_addr = User(
		tenant_id=t_a.id,
		user_login_id="dir_private_addr",
		user_password=pw,
		user_name="비공개주소",
		role="user",
		approval_status="approved",
		user_phone_number="01055556666",
		address="비밀주소",
		share_address_in_directory=False,
	)
	pending = User(
		tenant_id=t_a.id,
		user_login_id="dir_pending",
		user_password=pw,
		user_name="승인대기",
		role="user",
		approval_status="pending",
		user_phone_number="01077778888",
	)
	resigned = User(
		tenant_id=t_a.id,
		user_login_id="dir_resigned",
		user_password=pw,
		user_name="퇴사자",
		role="user",
		approval_status="approved",
		resignation_date=date(2024, 1, 1),
		user_phone_number="01099990000",
	)
	invisible = User(
		tenant_id=t_a.id,
		user_login_id="dir_invisible",
		user_password=pw,
		user_name="목록숨김",
		role="user",
		approval_status="approved",
		visible_in_user_list=False,
		user_phone_number="01000001111",
	)
	other_tenant = User(
		tenant_id=t_b.id,
		user_login_id="dir_other",
		user_password=pw,
		user_name="타테넌트",
		role="user",
		approval_status="approved",
		user_phone_number="01022223333",
	)
	db.add_all([viewer, shared, hidden_addr, pending, resigned, invisible, other_tenant])
	db.commit()
	for u in (viewer, shared, hidden_addr, pending, resigned, invisible, other_tenant):
		db.refresh(u)
	db.refresh(dept)
	return {
		"tenant_a": t_a,
		"tenant_b": t_b,
		"dept": dept,
		"viewer": viewer,
		"shared": shared,
		"hidden_addr": hidden_addr,
	}


def test_directory_list_filters_and_address_privacy():
	with memory_db_session() as db:
		seed = _seed_directory_db(db)
		viewer = seed["viewer"]
		token = _token_for(viewer, "valuesplay")

		def override_get_db():
			try:
				yield db
			finally:
				pass

		app_main.app.dependency_overrides[get_db] = override_get_db
		try:
			with TestClient(app_main.app, headers=TENANT_HEADERS) as client:
				client.cookies.set("accessToken", token)
				res = client.get("/api/hr/directory")
				assert res.status_code == status.HTTP_200_OK, res.text
				items = res.json()["items"]
				names = {i["user_name"] for i in items}
				assert "공개동료" in names
				assert "비공개주소" in names
				assert "조회자" in names
				assert "승인대기" not in names
				assert "퇴사자" not in names
				assert "목록숨김" not in names
				assert "타테넌트" not in names

				by_name = {i["user_name"]: i for i in items}
				assert by_name["공개동료"]["address"] == "서울 공개주소 1"
				assert by_name["비공개주소"]["address"] is None
				assert by_name["조회자"]["address"] is None

				for row in items:
					for key in SENSITIVE_KEYS:
						assert key not in row

				q = client.get("/api/hr/directory", params={"q": "공개동료"})
				assert q.status_code == status.HTTP_200_OK
				q_names = {i["user_name"] for i in q.json()["items"]}
				assert q_names == {"공개동료"}

				dept_id = seed["dept"].id
				d = client.get("/api/hr/directory", params={"department_id": dept_id})
				assert d.status_code == status.HTTP_200_OK
				d_names = {i["user_name"] for i in d.json()["items"]}
				assert "공개동료" in d_names
				assert "조회자" in d_names
				assert "비공개주소" not in d_names
		finally:
			app_main.app.dependency_overrides.pop(get_db, None)


def test_directory_org_groups_by_department():
	with memory_db_session() as db:
		seed = _seed_directory_db(db)
		viewer = seed["viewer"]
		token = _token_for(viewer, "valuesplay")

		def override_get_db():
			try:
				yield db
			finally:
				pass

		app_main.app.dependency_overrides[get_db] = override_get_db
		try:
			with TestClient(app_main.app, headers=TENANT_HEADERS) as client:
				client.cookies.set("accessToken", token)
				res = client.get("/api/hr/directory/org")
				assert res.status_code == status.HTTP_200_OK, res.text
				body = res.json()
				depts = body["departments"]
				assert len(depts) == 1
				assert depts[0]["department_name"] == "개발팀"
				dept_names = {m["user_name"] for m in depts[0]["members"]}
				assert "공개동료" in dept_names
				assert "조회자" in dept_names
				un_names = {m["user_name"] for m in body["unassigned"]}
				assert "비공개주소" in un_names
				assert "승인대기" not in un_names

				deps = client.get("/api/hr/directory/departments")
				assert deps.status_code == status.HTTP_200_OK
				assert deps.json()["items"][0]["department_name"] == "개발팀"
		finally:
			app_main.app.dependency_overrides.pop(get_db, None)


def test_directory_requires_auth():
	with TestClient(app_main.app, headers=TENANT_HEADERS) as client:
		res = client.get("/api/hr/directory")
		assert res.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
