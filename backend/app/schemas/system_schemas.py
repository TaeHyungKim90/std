from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class DepartmentCreate(BaseModel):
	department_name: str = Field(..., max_length=100)


class DepartmentUpdate(BaseModel):
	department_name: Optional[str] = Field(None, max_length=100)


class DepartmentResponse(BaseModel):
	id: int
	department_name: str
	created_at: datetime

	model_config = ConfigDict(from_attributes=True)


class PositionCreate(BaseModel):
	position_name: str = Field(..., max_length=100)


class PositionUpdate(BaseModel):
	position_name: Optional[str] = Field(None, max_length=100)


class PositionResponse(BaseModel):
	id: int
	position_name: str
	created_at: datetime

	model_config = ConfigDict(from_attributes=True)


class WorkLocationCreate(BaseModel):
	location_key: str = Field(..., min_length=2, max_length=50)
	location_value: str = Field(..., min_length=1, max_length=120)
	description: Optional[str] = Field(None, max_length=255)
	is_active: bool = True


class WorkLocationUpdate(BaseModel):
	location_key: Optional[str] = Field(None, min_length=2, max_length=50)
	location_value: Optional[str] = Field(None, min_length=1, max_length=120)
	description: Optional[str] = Field(None, max_length=255)
	is_active: Optional[bool] = None


class WorkLocationResponse(BaseModel):
	id: int
	location_key: str
	location_value: str
	description: Optional[str] = None
	is_active: bool
	created_at: datetime

	model_config = ConfigDict(from_attributes=True)

