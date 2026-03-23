from sqlalchemy import Column, Integer, String, DateTime, func
from db.session import Base

class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(Integer, primary_key=True, index=True)
    original_name = Column(String(255), nullable=False)  # 원본 파일명 (예: 이력서_최종.pdf)
    saved_name = Column(String(255), nullable=False, unique=True) # 서버 저장용 이름 (예: 20260319_1234_이력서.pdf)
    file_path = Column(String(500), nullable=False)      # 웹에서 접근할 URL 경로 (/uploads/...)
    file_size = Column(Integer, nullable=True)           # 파일 크기 (바이트)
    content_type = Column(String(100), nullable=True)    # 파일 타입 (application/pdf, image/png 등)
    created_at = Column(DateTime, server_default=func.now())