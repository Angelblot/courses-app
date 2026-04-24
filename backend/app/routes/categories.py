from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.product import Product
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate
from app.services.categories import CategoryService

router = APIRouter()


@router.get("/", response_model=List[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    """Liste des catégories canoniques enrichies du count de produits."""
    service = CategoryService(db)
    raw_labels = [row[0] for row in db.query(Product.category).all()]
    return service.catalog_with_counts(raw_labels)


@router.post("/", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    service = CategoryService(db)
    if service.get(payload.key) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La catégorie '{payload.key}' existe déjà.",
        )
    entry = service.create(
        key=payload.key,
        label=payload.label,
        icon=payload.icon,
        display_order=payload.display_order,
    )
    return CategoryOut(
        key=entry.key,
        label=entry.label,
        icon=entry.icon,
        display_order=entry.display_order,
        count=0,
    )


@router.put("/{key}", response_model=CategoryOut)
def update_category(key: str, payload: CategoryUpdate, db: Session = Depends(get_db)):
    service = CategoryService(db)
    entry = service.update(
        key,
        label=payload.label,
        icon=payload.icon,
        display_order=payload.display_order,
    )
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Catégorie '{key}' introuvable.",
        )
    count = service.count_products_for_key(key)
    return CategoryOut(
        key=entry.key,
        label=entry.label,
        icon=entry.icon,
        display_order=entry.display_order,
        count=count,
    )


@router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(key: str, db: Session = Depends(get_db)):
    service = CategoryService(db)
    if service.get(key) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Catégorie '{key}' introuvable.",
        )
    count = service.count_products_for_key(key)
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{count} produit(s) utilisent cette catégorie. Réassignez-les avant suppression.",
        )
    service.delete(key)
    return None
