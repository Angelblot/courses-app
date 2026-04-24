from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.list_item import ListItemOut


class ShoppingListBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class ShoppingListCreate(ShoppingListBase):
    pass


class ShoppingListUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    status: Optional[str] = None


class ShoppingListOut(ShoppingListBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    created_at: datetime
    items: List[ListItemOut] = []
