"""Schémas Pydantic pour les sessions du wizard de génération de courses."""
from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class WizardRecipeInput(BaseModel):
    """Recette sélectionnée dans le wizard avec son nombre de parts."""

    recipe_id: int
    servings: int = Field(..., ge=1)


class WizardQuotidienInput(BaseModel):
    """Item du quotidien sélectionné dans le wizard."""

    product_id: int
    needed: bool = True
    quantity: int = Field(1, ge=1)


class WizardExtraInput(BaseModel):
    """Extra ajouté manuellement par l'utilisateur dans le wizard."""

    name: str = Field(..., min_length=1, max_length=255)
    quantity: float = Field(1.0, ge=0)
    unit: str = Field("unité", min_length=1, max_length=20)
    rayon: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = Field(None, max_length=100)


class WizardConsolidatedItem(BaseModel):
    """Ligne consolidée (somme des recettes + quotidien + extras)."""

    name: str
    quantity: float
    unit: str
    rayon: Optional[str] = None
    category: Optional[str] = None
    product_id: Optional[int] = None
    food_id: Optional[int] = None
    product_label: Optional[str] = None


class WizardSessionCreate(BaseModel):
    """Payload de création d'une session wizard."""

    recipes: List[WizardRecipeInput] = Field(default_factory=list)
    quotidien: List[WizardQuotidienInput] = Field(default_factory=list)
    extras: List[WizardExtraInput] = Field(default_factory=list)


class WizardSessionOut(BaseModel):
    """Session wizard renvoyée par l'API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    payload: WizardSessionCreate
    consolidated_items: List[WizardConsolidatedItem] = []


class WizardGenerateRequest(BaseModel):
    """Requête de lancement de génération sur une session wizard."""

    drives: List[str] = Field(default_factory=list)


class WizardDriveResult(BaseModel):
    """Résultat d'un drive donné pour une session wizard."""

    items: List[Dict] = Field(default_factory=list)
    missing: List[Dict] = Field(default_factory=list)
    total: float = 0.0


class WizardResultsOut(BaseModel):
    """Résultats agrégés d'une session wizard, groupés par drive."""

    session_id: int
    status: str
    drives: Dict[str, WizardDriveResult] = Field(default_factory=dict)
