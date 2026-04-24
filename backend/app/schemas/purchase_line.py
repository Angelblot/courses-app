from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class PurchaseLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    drive_config_id: int
    quantity_ordered: int
    quantity_delivered: int
    unit_price_ht: Optional[float] = None
    unit_price_ttc: Optional[float] = None
    vat_rate: Optional[float] = None
    discount_ttc: Optional[float] = None
    total_ttc: Optional[float] = None
    purchase_date: Optional[date] = None
    created_at: datetime
    drive_name: Optional[str] = None


class ProductPriceHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: int
    points: List[PurchaseLineOut] = []
