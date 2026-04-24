from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.product import ProductOut


class ListItemBase(BaseModel):
    product_id: int
    quantity: int = Field(1, ge=1)
    checked: bool = False


class ListItemCreate(ListItemBase):
    pass


class ListItemUpdate(BaseModel):
    quantity: Optional[int] = Field(None, ge=1)
    checked: Optional[bool] = None
    added_to_cart: Optional[bool] = None
    drive_name: Optional[str] = None
    product_url: Optional[str] = None
    price_found: Optional[float] = None


class ListItemOut(ListItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    added_to_cart: bool
    drive_name: Optional[str] = None
    product_url: Optional[str] = None
    price_found: Optional[float] = None
    product: ProductOut
