from fastapi import APIRouter

from app.routes import drives, lists, products

api_router = APIRouter(prefix="/api")
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(lists.router, prefix="/lists", tags=["lists"])
api_router.include_router(drives.router, prefix="/drives", tags=["drives"])

__all__ = ["api_router"]
