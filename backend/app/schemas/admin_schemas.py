from pydantic import BaseModel

class AdminStats(BaseModel):
    user_count: int
    vacation_count: int
    category_count: int