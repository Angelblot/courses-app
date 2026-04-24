from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ProductDrive(Base):
    __tablename__ = "product_drives"
    __table_args__ = (
        UniqueConstraint("product_id", "drive_config_id", name="uq_product_drive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    drive_config_id: Mapped[int] = mapped_column(
        ForeignKey("drive_configs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
