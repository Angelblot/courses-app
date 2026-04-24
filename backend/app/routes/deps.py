from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.repositories.drive_config import DriveConfigRepository
from app.repositories.list_item import ListItemRepository
from app.repositories.product import ProductRepository
from app.repositories.shopping_list import ShoppingListRepository
from app.services.categories import CategoryService
from app.services.drive import DriveService
from app.services.list_item import ListItemService
from app.services.product import ProductService
from app.services.shopping_list import ShoppingListService


def product_service(db: Session = Depends(get_db)) -> ProductService:
    return ProductService(ProductRepository(db), CategoryService(db))


def list_item_service(db: Session = Depends(get_db)) -> ListItemService:
    return ListItemService(ListItemRepository(db), ShoppingListRepository(db))


def shopping_list_service(db: Session = Depends(get_db)) -> ShoppingListService:
    return ShoppingListService(
        ShoppingListRepository(db),
        ProductRepository(db),
        ListItemService(ListItemRepository(db), ShoppingListRepository(db)),
    )


def drive_service(db: Session = Depends(get_db)) -> DriveService:
    return DriveService(DriveConfigRepository(db))
