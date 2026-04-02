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

