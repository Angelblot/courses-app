from typing import Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ListItem(Base):
    __tablename__ = "list_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    shopping_list_id: Mapped[int] = mapped_column(ForeignKey("shopping_lists.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    checked: Mapped[bool] = mapped_column(Boolean, default=False)
    added_to_cart: Mapped[bool] = mapped_column(Boolean, default=False)
    drive_name: Mapped[Optional[str]] = mapped_column(String(50))
    product_url: Mapped[Optional[str]] = mapped_column(Text)
    price_found: Mapped[Optional[float]] = mapped_column(Float)

    shopping_list: Mapped["ShoppingList"] = relationship(back_populates="items")  # noqa: F821
    product: Mapped["Product"] = relationship(lazy="joined")  # noqa: F821
