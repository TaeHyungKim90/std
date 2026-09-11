from fastapi import APIRouter

from .attendance import router as attendance_router
from .directory import router as directory_router
from .reports import router as reports_router
from .todos import router as todo_router

router = APIRouter()

# 하위 라우터들을 통합 등록합니다.
# 여기서 설정한 prefix가 최종 URL 주소의 중간 경로가 됩니다.

# 결과: /api/hr/attendance/...
router.include_router(attendance_router, prefix="/attendance", tags=["HR-Attendance"])

# 결과: /api/hr/todos/...
router.include_router(todo_router, prefix="/todos", tags=["HR-Todos"])

router.include_router(reports_router, prefix="/reports", tags=["HR-Reports"])

# 결과: /api/hr/directory/...
router.include_router(directory_router, prefix="/directory", tags=["HR-Directory"])
from .expenses import router as expenses_router
router.include_router(expenses_router, prefix="/expenses", tags=["HR-Expenses"])
