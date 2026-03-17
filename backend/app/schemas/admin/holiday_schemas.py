from pydantic import BaseModel
from datetime import date
from typing import Optional

class HolidayBase(BaseModel):
    holiday_date: date
    holiday_name: str
    is_official: bool = True
    description: Optional[str] = None

class HolidayCreate(HolidayBase):
    pass

class HolidayUpdate(BaseModel):
    holiday_name: Optional[str] = None
    is_official: Optional[bool] = None
    description: Optional[str] = None

class HolidayOut(HolidayBase):
    id: int

    class Config:
        from_attributes = True