from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from models.message_models import MessageType

# --- 첨부파일 & 유저 정보 응답용 ---
class UploadedFileResponse(BaseModel):
	id: int
	file_path: str
	original_name: str

	model_config = ConfigDict(from_attributes=True)

class AttachmentResponse(BaseModel):
	id: int
	file_id: int
	file_info: Optional[UploadedFileResponse] = None

	model_config = ConfigDict(from_attributes=True)

class MessageUserResponse(BaseModel):
	id: int
	user_name: str

	model_config = ConfigDict(from_attributes=True)

# --- 메인 메시지 DTO ---
class MessageCreate(BaseModel):
	title: str
	content: Optional[str] = None
	message_type: MessageType = MessageType.INDIVIDUAL
	is_global: bool = False
	receiver_id: Optional[int] = None
	file_ids: Optional[List[int]] = []	# 🌟 업로드된 파일 ID들을 배열로 받음

class MessageResponse(BaseModel):
	id: int
	title: str
	content: Optional[str] = None
	message_type: MessageType
	is_global: bool
	sender_id: int
	sender: Optional[MessageUserResponse] = None	# 보낸 사람 정보
	receiver_id: Optional[int] = None
	receiver: Optional[MessageUserResponse] = None # 받는 사람 정보
	created_at: datetime
	is_read: bool
	attachments: List[AttachmentResponse] = []	# 첨부파일 목록

	model_config = ConfigDict(from_attributes=True)


class MessageListPage(BaseModel):
	items: List[MessageResponse]
	total: int