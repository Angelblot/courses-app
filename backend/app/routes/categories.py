from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.product import Product
from app.schemas.category import CategoryOut
from app.services.categories import CategoryService

router = APIRouter()


@router.get("/", response_model=List[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    """Liste des catégories canoniques enrichies du count de produits."""
    service = CategoryService(db)
    raw_labels = [row[0] for row in db.query(Product.category).all()]
    return service.catalog_with_counts(raw_labels)
