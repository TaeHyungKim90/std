from datetime import date


from sqlalchemy import Column, Integer, String, Date, Boolean
from db.session import Base

class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    holiday_date = Column[date](Date, unique=True, nullable=False, index=True) # 공휴일 날짜
    holiday_name = Column[str](String(50), nullable=False)                   # 공휴일 명칭 (예: 추석, 창립기념일)
    is_official = Column[bool](Boolean, default=True)                         # True: 법정공휴일, False: 회사지정휴무
    description = Column[str](String(200), nullable=True)                    # 상세 설명