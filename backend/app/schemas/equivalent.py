from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ProductEquivalentBase(BaseModel):
    drive_name: str = Field(..., min_length=1, max_length=50)
    search_query: str = Field(..., min_length=1)
    expected_brand: Optional[str] = Field(None, max_length=100)
    expected_ean13: Optional[str] = Field(None, max_length=13)


class ProductEquivalentCreate(ProductEquivalentBase):
    pass


class ProductEquivalentOut(ProductEquivalentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    last_confirmed_at: Optional[datetime] = None


class WizardPlanItem(BaseModel):
    """Élément renvoyé par ``GET /api/wizard/plan``.

    ``confidence`` vaut ``low`` quand aucun equivalent n'a été confirmé dans
    les 30 derniers jours et que la requête est issue de la stratégie
    déterministe ; ``high`` sinon.
    """

    model_config = ConfigDict(from_attributes=True)

    product_id: int
    name: str
    brand: Optional[str] = None
    brand_type: str
    store_brand_affinity: Optional[str] = None
    search_query: str
    confidence: Literal["high", "low"]
