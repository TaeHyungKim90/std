from sqlalchemy import Column, Integer, String, Date, Boolean
from database import Base

class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    holiday_date = Column(Date, unique=True, nullable=False, index=True) # 공휴일 날짜
    holiday_name = Column(String(50), nullable=False)                   # 공휴일 명칭 (예: 추석, 창립기념일)
    is_official = Column(Boolean, default=True)                         # True: 법정공휴일, False: 회사지정휴무
    description = Column(String(200), nullable=True)                    # 상세 설명