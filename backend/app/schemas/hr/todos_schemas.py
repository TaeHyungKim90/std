#todos_schemas.py
from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
from datetime import  datetime

class AuthorInfo(BaseModel):
    user_name: str
    user_nickname: Optional[str] = None

    # SQLAlchemy 객체를 Pydantic으로 변환하기 위한 설정
    model_config = ConfigDict(from_attributes=True)
# --- Todo Schemas ---
class TodoBase(BaseModel):
    title: str
    description: Optional[str] = None
    start_date: datetime             # 모델의 컬럼명과 일치
    end_date: Optional[datetime] = None # 모델의 컬럼명과 일치
    color: Optional[str] = "#3788d8"
    category: Optional[str] = None

class TodoCreate(TodoBase):
    pass

class TodoUpdate(TodoBase):
    # 수정 시에는 모든 필드가 선택 사항이 되도록 Optional 처리
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    color: Optional[str] = None
    category: Optional[str] = None

class Todo(TodoBase):
    id: int
    user_id: str
    created_at: datetime
    updated_at: datetime
    author: Optional[AuthorInfo] = None
    # SQLAlchemy 모델 객체를 Pydantic 모델로 변환하기 위한 설정 (V2 기준)
    model_config = ConfigDict(from_attributes=True)

class TodoList(BaseModel):
    todos: List[Todo]

class CategoryTypeCreate(BaseModel):
    category_key: str
    category_name: str
    icon: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class TodoConfigBase(BaseModel):
    category_key: str
    color: str = Field("#3788d8", pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$")
    default_description: Optional[str] = None # 이번에 추가된 필드

# 등록 시 사용 (유저 ID 등이 포함될 수 있음)
class TodoConfigCreate(TodoConfigBase):
    pass

# 수정 시 사용
class TodoConfigUpdate(TodoConfigBase):
    # 수정 시 특정 필드만 선택적으로 받고 싶다면 Optional로 덮어씌울 수 있음
    pass

# API 응답 시 사용 (ID나 관계 데이터 포함)
class TodoConfigRead(TodoConfigBase):
    id: int
    user_id: str
    
    model_config = ConfigDict(from_attributes=True)
