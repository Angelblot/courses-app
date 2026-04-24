from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.drive_config import DriveConfig
    from app.models.purchase_line import PurchaseLine


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ean13: Mapped[Optional[str]] = mapped_column(String(13), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    brand: Mapped[Optional[str]] = mapped_column(String(100))
    category: Mapped[Optional[str]] = mapped_column(String(100))
    default_quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit: Mapped[str] = mapped_column(String(20), default="unité")
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    price_ht: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    price_ttc: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    vat_rate: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    drives: Mapped[List["DriveConfig"]] = relationship(
        secondary="product_drives",
        back_populates="products",
        lazy="selectin",
    )
    purchase_lines: Mapped[List["PurchaseLine"]] = relationship(
        back_populates="product",
        lazy="selectin",
    )

    @property
    def drive_names(self) -> List[str]:
        return [d.name for d in self.drives]

    @property
    def drive_ids(self) -> List[int]:
        return [d.id for d in self.drives]

    @property
    def purchase_count(self) -> int:
        return len(self.purchase_lines or [])

    @property
    def price_trend(self) -> Optional[str]:
        lines = self.purchase_lines or []
        usable = [l for l in lines if l.unit_price_ttc is not None and l.purchase_date is not None]
        if len(usable) < 2:
            return None
        sorted_lines = sorted(usable, key=lambda l: l.purchase_date, reverse=True)
        latest = float(sorted_lines[0].unit_price_ttc)
        previous = float(sorted_lines[1].unit_price_ttc)
        if previous == 0:
            return None
        delta = (latest - previous) / previous
        if delta > 0.02:
            return "up"
        if delta < -0.02:
            return "down"
        return "stable"
