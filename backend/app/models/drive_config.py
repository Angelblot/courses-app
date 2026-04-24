from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.product import Product


class DriveConfig(Base):
    __tablename__ = "drive_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(100))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    credentials_encrypted: Mapped[Optional[str]] = mapped_column(Text)
    default_store: Mapped[Optional[str]] = mapped_column(String(100))

    products: Mapped[List["Product"]] = relationship(
        secondary="product_drives",
        back_populates="drives",
        lazy="select",
    )
    purchase_lines: Mapped[List["PurchaseLine"]] = relationship(
        back_populates="drive",
        lazy="selectin",
    )
