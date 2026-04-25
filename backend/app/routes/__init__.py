from fastapi import APIRouter

from app.routes import categories, drives, lists, products, seed, wizard

api_router = APIRouter(prefix="/api")
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(lists.router, prefix="/lists", tags=["lists"])
api_router.include_router(drives.router, prefix="/drives", tags=["drives"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(wizard.router, prefix="/wizard", tags=["wizard"])
api_router.include_router(seed.router)

__all__ = ["api_router"]
