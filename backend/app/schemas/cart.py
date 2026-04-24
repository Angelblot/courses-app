from typing import List, Optional

from pydantic import BaseModel, Field


class CartItem(BaseModel):
    product_name: str
    quantity: int = Field(1, ge=1)
    drive_name: str


class CartResult(BaseModel):
    success: bool
    drive: str
    items_added: int = 0
    items_failed: List[str] = []
    total_approx: Optional[float] = None
    cart_url: Optional[str] = None
    errors: List[str] = []
