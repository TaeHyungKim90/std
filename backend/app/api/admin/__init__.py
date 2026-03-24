from fastapi import APIRouter
from .stats import router as stats_router
from .todos import router as todos_router
from .category_types import router as category_router
from .attendance import router as attendance_router
from .users import router as users_router
from .holidays import router as holiday_router
from .recruitment import router as recruitment_router

router = APIRouter()

# 각각의 세부 라우터들을 등록
router.include_router(stats_router, prefix="/stats")
router.include_router(todos_router, prefix="/todos")
router.include_router(category_router, prefix="/category-types")
router.include_router(attendance_router, prefix="/attendance")
router.include_router(users_router, prefix="/users")
router.include_router(holiday_router, prefix="/holidays")
router.include_router(recruitment_router, prefix="/recruitment")