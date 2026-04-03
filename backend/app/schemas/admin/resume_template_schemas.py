from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ResumeTemplateResponse(BaseModel):
	id: int
	name: str
	file_path: str
	is_default: bool
	is_deleted: bool
	created_at: datetime

	model_config = ConfigDict(from_attributes=True)


class ResumeTemplateListPage(BaseModel):
	items: List[ResumeTemplateResponse]
	total: int


class ResumeTemplatePatch(BaseModel):
	name: Optional[str] = Field(None, max_length=200)
	is_default: Optional[bool] = None
