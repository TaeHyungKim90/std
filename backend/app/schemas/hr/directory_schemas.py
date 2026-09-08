"""직원 연락처·조직도 응답 스키마 (민감정보 제외)."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class DirectoryUserResponse(BaseModel):
	id: int
	user_name: str
	user_nickname: Optional[str] = None
	user_phone_number: Optional[str] = None
	address: Optional[str] = None
	department_id: Optional[int] = None
	position_id: Optional[int] = None
	department_name: Optional[str] = None
	position_name: Optional[str] = None
	user_profile_image_url: Optional[str] = None
	avatar_zoom: float = 1.0
	avatar_offset_x: float = 0.0
	avatar_offset_y: float = 0.0

	model_config = ConfigDict(from_attributes=True)


class DirectoryListResponse(BaseModel):
	items: list[DirectoryUserResponse]


class DirectoryOrgDepartment(BaseModel):
	id: int
	department_name: str
	members: list[DirectoryUserResponse] = Field(default_factory=list)


class DirectoryOrgResponse(BaseModel):
	departments: list[DirectoryOrgDepartment] = Field(default_factory=list)
	unassigned: list[DirectoryUserResponse] = Field(default_factory=list)


class DirectoryDepartmentItem(BaseModel):
	id: int
	department_name: str

	model_config = ConfigDict(from_attributes=True)


class DirectoryDepartmentListResponse(BaseModel):
	items: list[DirectoryDepartmentItem]
