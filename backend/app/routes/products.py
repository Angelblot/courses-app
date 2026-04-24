from typing import List, Optional

from fastapi import APIRouter, Depends, status

from app.routes.deps import product_service
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate
from app.schemas.purchase_line import ProductPriceHistoryOut
from app.services.product import ProductService

router = APIRouter()


@router.get("/", response_model=List[ProductOut])
def list_products(
    favorite_only: bool = False,
    drive: Optional[str] = None,
    svc: ProductService = Depends(product_service),
):
    return svc.list(favorite_only=favorite_only, drive=drive)


@router.post("/", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, svc: ProductService = Depends(product_service)):
    return svc.create(payload)


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, svc: ProductService = Depends(product_service)):
    return svc.get(product_id)


@router.get("/{product_id}/price-history", response_model=ProductPriceHistoryOut)
def get_product_price_history(
    product_id: int, svc: ProductService = Depends(product_service)
):
    return svc.get_price_history(product_id)


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    svc: ProductService = Depends(product_service),
):
    return svc.update(product_id, payload)


@router.delete("/{product_id}")
def delete_product(product_id: int, svc: ProductService = Depends(product_service)):
    svc.delete(product_id)
    return {"ok": True}
