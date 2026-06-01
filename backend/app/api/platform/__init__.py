from fastapi import APIRouter

from .auth import router as auth_router
from .tenants import router as tenants_router

router = APIRouter(prefix="/platform")
router.include_router(auth_router)
router.include_router(tenants_router)
