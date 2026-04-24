from typing import List, Optional

from fastapi import HTTPException, status

from app.models.product import Product
from app.repositories.product import ProductRepository
from app.schemas.product import ProductCreate, ProductUpdate
from app.schemas.purchase_line import ProductPriceHistoryOut, PurchaseLineOut


class ProductService:
    def __init__(self, repo: ProductRepository):
        self.repo = repo

    def list(
        self,
        favorite_only: bool = False,
        drive: Optional[str] = None,
    ) -> List[Product]:
        return self.repo.list(favorite_only=favorite_only, drive=drive)

    def get(self, product_id: int) -> Product:
        product = self.repo.get(product_id)
        if not product:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Produit non trouvé")
        return product

    def create(self, data: ProductCreate) -> Product:
        return self.repo.add(Product(**data.model_dump()))

    def update(self, product_id: int, data: ProductUpdate) -> Product:
        product = self.get(product_id)
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(product, key, value)
        return self.repo.save(product)

    def delete(self, product_id: int) -> None:
        self.repo.delete(self.get(product_id))

    def get_price_history(self, product_id: int) -> ProductPriceHistoryOut:
        self.get(product_id)
        rows = self.repo.get_price_history(product_id)
        points = []
        for line, drive_name in rows:
            item = PurchaseLineOut.model_validate(line)
            item.drive_name = drive_name
            points.append(item)
        return ProductPriceHistoryOut(product_id=product_id, points=points)
