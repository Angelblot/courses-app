"""Schémas Pydantic pour les aliments (couche ALIMENT)."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class FoodBase(BaseModel):
    """Champs communs d'un aliment."""

    name: str = Field(..., min_length=1, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    default_unit: str = Field("g", max_length=20)
    synonyms: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=500)


class FoodCreate(FoodBase):
    """Payload de création d'un aliment."""


class FoodUpdate(BaseModel):
    """Payload de mise à jour partielle d'un aliment."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    default_unit: Optional[str] = Field(None, max_length=20)
    synonyms: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=500)


class FoodProductOut(BaseModel):
    """Association aliment ↔ produit, telle que renvoyée par l'API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    food_id: int
    product_id: int
    priority: int
    is_preferred: bool
    created_at: datetime

    # Produit embarqué pour avoir le nom, l'image, etc.
    product_name: Optional[str] = None
    product_image_url: Optional[str] = None
    product_brand: Optional[str] = None
    product_category: Optional[str] = None
    product_unit: Optional[str] = None
    product_grammage_g: Optional[int] = None
    product_volume_ml: Optional[int] = None
    product_brand_type: Optional[str] = None


class FoodProductCreate(BaseModel):
    """Payload pour associer un produit à un aliment."""

    product_id: int = Field(..., ge=1)
    priority: int = Field(100, ge=1)
    is_preferred: bool = False


class FoodOut(FoodBase):
    """Aliment renvoyé par l'API (avec ses produits associés)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    products: List[FoodProductOut] = []
