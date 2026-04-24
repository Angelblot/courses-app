from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PurchaseLine(Base):
    __tablename__ = "purchase_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    drive_config_id: Mapped[int] = mapped_column(ForeignKey("drive_configs.id"), nullable=False)

    quantity_ordered: Mapped[int] = mapped_column(Integer, default=0)
    quantity_delivered: Mapped[int] = mapped_column(Integer, default=0)
    unit_price_ht: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    unit_price_ttc: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    vat_rate: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    discount_ttc: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    total_ttc: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))

    purchase_date: Mapped[Optional[date]] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    product: Mapped["Product"] = relationship(back_populates="purchase_lines")
    drive: Mapped["DriveConfig"] = relationship(back_populates="purchase_lines")
