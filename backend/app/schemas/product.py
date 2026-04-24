from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ProductBase(BaseModel):
    ean13: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=255)
    brand: Optional[str] = None
    category: Optional[str] = None
    default_quantity: int = Field(1, ge=1)
    unit: str = "unité"
    favorite: bool = False
    notes: Optional[str] = None
    price_ht: Optional[float] = None
    price_ttc: Optional[float] = None
    vat_rate: Optional[float] = None
    image_url: Optional[str] = Field(None, max_length=500)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    ean13: Optional[str] = None
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    brand: Optional[str] = None
    category: Optional[str] = None
    default_quantity: Optional[int] = Field(None, ge=1)
    unit: Optional[str] = None
    favorite: Optional[bool] = None
    notes: Optional[str] = None
    price_ht: Optional[float] = None
    price_ttc: Optional[float] = None
    vat_rate: Optional[float] = None
    image_url: Optional[str] = Field(None, max_length=500)


class ProductOut(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    drive_names: List[str] = []
    drive_ids: List[int] = []
    purchase_count: int = 0
    price_trend: Optional[str] = None
    category_key: Optional[str] = None
    category_label: Optional[str] = None
