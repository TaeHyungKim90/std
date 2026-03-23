from fastapi import APIRouter
from .recruitment import router as recruitment_router

router = APIRouter()
router.include_router(recruitment_router, prefix="/recruitment", tags=["Recruitment"])