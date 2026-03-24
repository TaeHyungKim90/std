import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship

# 프로젝트 기존 구조에 맞춘 Base 임포트
from db.session import Base
# 관계 설정을 위한 모델 임포트
from models.common_models import UploadedFile
from models.auth_models import User

class MessageType(enum.Enum):
    INDIVIDUAL = "individual"  # 개별 메시지 (급여명세서 등)
    GLOBAL = "global"          # 전체 공지사항

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=True)  # SunEditor HTML 내용
    
    # 메시지 성격 구분
    message_type = Column(Enum(MessageType), default=MessageType.INDIVIDUAL)
    is_global = Column(Boolean, default=False)
    
    # 발송자 (관리자)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # 수신자 (개별 메시지일 때만 값이 있음)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.now)
    is_read = Column(Boolean, default=False)

    # 🤝 관계 설정
    # foreign_keys를 명시하여 sender와 receiver를 정확히 구분합니다.
    sender = relationship("User", foreign_keys=[sender_id], backref="sent_messages")
    receiver = relationship("User", foreign_keys=[receiver_id], backref="received_messages")
    
    # 메시지 삭제 시 연결된 attachment 기록도 함께 삭제 (파일 실제 삭제는 별도 로직)
    attachments = relationship("MessageAttachment", back_populates="message", cascade="all, delete-orphan")

class MessageAttachment(Base):
    __tablename__ = "message_attachments"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False)
    
    # 🌟 기존 UploadedFile 테이블의 ID를 그대로 사용 (재사용성 극대화)
    file_id = Column(Integer, ForeignKey("uploaded_files.id"), nullable=False)
    
    created_at = Column(DateTime, default=datetime.now)

    # 🤝 관계 설정
    message = relationship("Message", back_populates="attachments")
    # 파일의 실제 경로(file_path), 원본이름(original_name) 등을 가져올 수 있게 함
    file_info = relationship("UploadedFile")