"""Routes de résolution d'ingrédients en produits du catalogue.

Permet de :
- Résoudre un ingrédient en top 3 produits avec scores et quantités calculées.
- Sauvegarder le choix utilisateur dans user_product_preferences.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.product import Product
from app.models.product_preference import UserProductPreference
from app.services.product_resolver import ProductResolver

router = APIRouter()


# ---------------------------------------------------------------------------
# Schémas
# ---------------------------------------------------------------------------


class ResolveRequest(BaseModel):
    """Requête de résolution d'un ingrédient."""

    ingredient_name: str = Field(..., min_length=1, max_length=255)
    ingredient_qty: float = Field(0.0, ge=0.0)
    ingredient_unit: str = Field("unité", max_length=20)
    category_hint: Optional[str] = Field(None, max_length=100)
    limit: int = Field(3, ge=1, le=10)


class ResolvedProductItem(BaseModel):
    """Produit résolu avec score et quantité calculée."""

    product_id: int
    product_name: str
    brand: Optional[str] = None
    brand_type: Optional[str] = None
    store_brand_affinity: Optional[str] = None
    category: Optional[str] = None
    grammage_g: Optional[int] = None
    volume_ml: Optional[int] = None
    unit: str = "unité"
    image_url: Optional[str] = None
    score: float = 0.0
    pack_count: int = 1
    actual_grammage: Optional[int] = None
    reason: str = ""


class ResolveResponse(BaseModel):
    """Réponse de résolution d'un ingrédient."""

    ingredient_name: str
    candidates: List[ResolvedProductItem] = []
    total_candidates: int = 0


class SelectRequest(BaseModel):
    """Sauvegarde du choix utilisateur pour un ingrédient."""

    ingredient_name: str = Field(..., min_length=1, max_length=255)
    product_id: int = Field(..., ge=1)
    qty: Optional[int] = Field(None, ge=1)


class SelectResponse(BaseModel):
    """Réponse après sauvegarde du choix utilisateur."""

    status: str = "ok"
    ingredient_name: str
    product_id: int
    selection_count: int


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/resolve", response_model=ResolveResponse)
def resolve_ingredient(
    payload: ResolveRequest,
    db: Session = Depends(get_db),
) -> ResolveResponse:
    """Résout un ingrédient en produits du catalogue.

    Pour un ingrédient donné, trouve les meilleurs produits candidats
    avec leur score et la quantité calculée (NEAREST_PACK).

    Args:
        payload: Nom de l'ingrédient, quantité, unité, indice de catégorie.
        db: Session SQLAlchemy.

    Returns:
        Liste des top N produits avec scores et quantités.
    """
    resolver = ProductResolver(db)
    results = resolver.resolve(
        ingredient_name=payload.ingredient_name,
        ingredient_qty=payload.ingredient_qty,
        ingredient_unit=payload.ingredient_unit,
        category_hint=payload.category_hint,
        limit=payload.limit,
    )
    candidates = [
        ResolvedProductItem(**r.to_dict()) for r in results
    ]
    return ResolveResponse(
        ingredient_name=payload.ingredient_name,
        candidates=candidates,
        total_candidates=len(candidates),
    )


@router.post("/select", response_model=SelectResponse)
def select_product(
    payload: SelectRequest,
    db: Session = Depends(get_db),
) -> SelectResponse:
    """Sauvegarde le choix utilisateur pour un ingrédient.

    Incrémente le compteur de préférence si le couple
    (ingredient_name, product_id) existe déjà, le crée sinon.

    Args:
        payload: Nom de l'ingrédient et ID du produit choisi.
        db: Session SQLAlchemy.

    Returns:
        Confirmation avec le nombre total de sélections.
    """
    # Vérifie que le produit existe
    product = db.get(Product, payload.product_id)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Produit {payload.product_id} non trouvé",
        )

    ingredient_name = payload.ingredient_name.strip().lower()

    # Cherche une préférence existante
    stmt = select(UserProductPreference).where(
        UserProductPreference.ingredient_name == ingredient_name,
        UserProductPreference.product_id == payload.product_id,
    )
    pref = db.execute(stmt).scalar_one_or_none()

    if pref:
        pref.count += 1
        pref.last_selected = datetime.utcnow()
    else:
        pref = UserProductPreference(
            ingredient_name=ingredient_name,
            product_id=payload.product_id,
            count=1,
            last_selected=datetime.utcnow(),
        )
        db.add(pref)

    db.commit()
    db.refresh(pref)

    return SelectResponse(
        status="ok",
        ingredient_name=ingredient_name,
        product_id=payload.product_id,
        selection_count=pref.count,
    )
