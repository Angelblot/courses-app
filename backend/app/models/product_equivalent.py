from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.product import Product


class ProductEquivalent(Base):
    """Mapping d'un produit interne vers une requête de recherche par drive.

    Un override stocké dans cette table est prioritaire sur la stratégie
    déterministe ``SearchStrategyService.build_search_query`` quand
    ``last_confirmed_at`` est récent (< 30 jours).
    """

    __tablename__ = "product_equivalents"
    __table_args__ = (
        UniqueConstraint("product_id", "drive_name", name="uq_product_equivalent_drive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    drive_name: Mapped[str] = mapped_column(String(50), nullable=False)
    search_query: Mapped[str] = mapped_column(Text, nullable=False)
    expected_brand: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    expected_ean13: Mapped[Optional[str]] = mapped_column(String(13), nullable=True)
    last_confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    product: Mapped["Product"] = relationship(back_populates="equivalents")
