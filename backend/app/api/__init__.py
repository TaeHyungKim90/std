from fastapi import APIRouter

from .common import router as common
from .auth import router as auth
from .admin import router as admin
from .hr import router as hr
from .public import router as public
from .messages import router as messages
api_router = APIRouter()
api_router.include_router(auth, prefix="/auth", tags=["Auth"])
api_router.include_router(auth, prefix="/auth", tags=["Auth"])
api_router.include_router(admin, prefix="/admin", tags=["Admin"])
api_router.include_router(hr, prefix="/hr", tags=["HR"])
api_router.include_router(common, prefix="/common", tags=["Common"])
api_router.include_router(public, prefix="/public", tags=["Public"])
api_router.include_router(messages, prefix="/messages", tags=["Messages"])