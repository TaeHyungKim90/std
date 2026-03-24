from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from enum import Enum

# 1. 메시지 타입 정의
class MessageType(str, Enum):
    INDIVIDUAL = "individual"  # 개별 (명세서)
    GLOBAL = "global"          # 전체 공지

# 2. 첨부파일 정보 (기존 UploadedFile 기반)
class MessageAttachmentRead(BaseModel):
    id: int
    file_name: str
    file_size: int
    
    class Config:
        from_attributes = True

# 3. [공용] 메시지 기본 정보
class MessageBase(BaseModel):
    title: str
    content: Optional[str] = None
    message_type: MessageType = MessageType.INDIVIDUAL

# 4. [Admin용] 메시지 생성 요청
class MessageCreate(MessageBase):
    receiver_id: Optional[int] = None # 전체 공지일 땐 None 가능

# 5. [User/Admin 공용] 메시지 상세 조회 응답
class MessageRead(MessageBase):
    id: int
    sender_id: int
    receiver_id: Optional[int]
    created_at: datetime
    is_read: bool
    attachments: List[MessageAttachmentRead] = []

    class Config:
        from_attributes = True