from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class FileUploadResponse(BaseModel):
	id: int
	original_name: str
	file_path: str # 프론트엔드에서 사용할 URL
	file_size: Optional[int]
	content_type: Optional[str]
	created_at: datetime

	class Config:
		from_attributes = True