"""Schémas Pydantic pour les recettes."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class RecipeIngredientBase(BaseModel):
    """Champs communs d'un ingrédient de recette."""

    product_id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=255)
    quantity_per_serving: float = Field(0.0, ge=0)
    unit: str = Field("unité", min_length=1, max_length=20)
    rayon: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = Field(None, max_length=100)


class RecipeIngredientCreate(RecipeIngredientBase):
    """Payload de création d'un ingrédient (au sein d'une recette)."""


class RecipeIngredientOut(RecipeIngredientBase):
    """Ingrédient renvoyé par l'API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    recipe_id: int


class RecipeBase(BaseModel):
    """Champs communs d'une recette."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    servings_default: int = Field(4, ge=1)
    category: Optional[str] = Field(None, max_length=100)
    image_url: Optional[str] = Field(None, max_length=500)


class RecipeCreate(RecipeBase):
    """Payload de création d'une recette avec ses ingrédients."""

    ingredients: List[RecipeIngredientCreate] = Field(default_factory=list)


class RecipeUpdate(BaseModel):
    """Payload de mise à jour partielle d'une recette."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    servings_default: Optional[int] = Field(None, ge=1)
    category: Optional[str] = Field(None, max_length=100)
    image_url: Optional[str] = Field(None, max_length=500)
    ingredients: Optional[List[RecipeIngredientCreate]] = None


class RecipeOut(RecipeBase):
    """Recette renvoyée en liste (avec ingrédients embarqués)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    ingredients: List[RecipeIngredientOut] = []


class RecipeDetail(RecipeOut):
    """Détail complet d'une recette (alias sémantique de ``RecipeOut``)."""
