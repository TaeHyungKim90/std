from datetime import datetime

from pydantic import BaseModel, Field


class PlatformLoginRequest(BaseModel):
	login_id: str = Field(min_length=1, max_length=50)
	password: str = Field(min_length=1, max_length=128)


class PlatformLoginResponse(BaseModel):
	success: bool = True
	login_id: str
	name: str


class PlatformMeResponse(BaseModel):
	isLoggedIn: bool
	login_id: str | None = None
	name: str | None = None


class TenantCreateRequest(BaseModel):
	slug: str = Field(min_length=2, max_length=50)
	name: str = Field(min_length=1, max_length=200)
	bootstrap_admin_login_id: str | None = Field(default=None, max_length=50)
	bootstrap_admin_password: str | None = Field(default=None, max_length=128)


class TenantUpdateRequest(BaseModel):
	name: str | None = Field(default=None, min_length=1, max_length=200)
	is_active: bool | None = None


class TenantAdminResponse(BaseModel):
	id: int
	slug: str
	name: str
	is_active: bool
	created_at: datetime

	model_config = {"from_attributes": True}
