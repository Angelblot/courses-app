from typing import List, Optional, Tuple

from sqlalchemy import desc, select

from app.models.drive_config import DriveConfig
from app.models.product import Product
from app.models.purchase_line import PurchaseLine
from app.repositories.base import BaseRepository


class ProductRepository(BaseRepository[Product]):
    model = Product

    def list(
        self,
        favorite_only: bool = False,
        drive: Optional[str] = None,
    ) -> List[Product]:
        stmt = select(Product)
        if favorite_only:
            stmt = stmt.where(Product.favorite.is_(True))
        if drive:
            stmt = stmt.join(Product.drives).where(DriveConfig.name == drive)
        stmt = stmt.order_by(Product.name)
        return list(self.db.execute(stmt).scalars().unique())

    def list_favorites(self) -> List[Product]:
        return self.list(favorite_only=True)

    def list_by_drive(self, drive_name: str) -> List[Product]:
        return self.list(drive=drive_name)

    def update_image_url(self, product_id: int, url: Optional[str]) -> Optional[Product]:
        product = self.get(product_id)
        if product is None:
            return None
        product.image_url = url
        self.db.commit()
        self.db.refresh(product)
        return product

    def get_price_history(self, product_id: int) -> List[Tuple[PurchaseLine, str]]:
        stmt = (
            select(PurchaseLine, DriveConfig.name)
            .join(DriveConfig, DriveConfig.id == PurchaseLine.drive_config_id)
            .where(PurchaseLine.product_id == product_id)
            .order_by(desc(PurchaseLine.purchase_date), desc(PurchaseLine.id))
        )
        return [(row[0], row[1]) for row in self.db.execute(stmt).all()]
