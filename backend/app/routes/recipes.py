"""Routes CRUD pour les recettes."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.recipe import Recipe, RecipeIngredient
from app.schemas.recipe import (
    RecipeCreate,
    RecipeDetail,
    RecipeOut,
    RecipeUpdate,
)

router = APIRouter()


def _get_or_404(db: Session, recipe_id: int) -> Recipe:
    """Récupère une recette ou lève 404.

    Args:
        db: Session SQLAlchemy.
        recipe_id: Identifiant de la recette.

    Returns:
        L'instance ``Recipe`` correspondante.

    Raises:
        HTTPException: 404 si la recette est introuvable.
    """
    recipe = db.get(Recipe, recipe_id)
    if recipe is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recette non trouvée")
    return recipe


@router.get("/", response_model=List[RecipeOut])
def list_recipes(db: Session = Depends(get_db)) -> List[Recipe]:
    """Liste toutes les recettes avec leurs ingrédients.

    Args:
        db: Session SQLAlchemy injectée.

    Returns:
        Liste de ``Recipe`` triées par date de création décroissante.
    """
    stmt = select(Recipe).order_by(Recipe.created_at.desc())
    return list(db.execute(stmt).scalars())


@router.post("/", response_model=RecipeDetail, status_code=status.HTTP_201_CREATED)
def create_recipe(payload: RecipeCreate, db: Session = Depends(get_db)) -> Recipe:
    """Crée une recette et ses ingrédients en une seule transaction.

    Args:
        payload: Données de la recette + ingrédients.
        db: Session SQLAlchemy injectée.

    Returns:
        La recette créée avec ses ingrédients.
    """
    recipe = Recipe(
        name=payload.name,
        description=payload.description,
        servings_default=payload.servings_default,
        category=payload.category,
        image_url=payload.image_url,
    )
    for ing in payload.ingredients:
        recipe.ingredients.append(RecipeIngredient(**ing.model_dump()))
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return recipe


@router.get("/{recipe_id}", response_model=RecipeDetail)
def get_recipe(recipe_id: int, db: Session = Depends(get_db)) -> Recipe:
    """Récupère une recette par son identifiant.

    Args:
        recipe_id: Identifiant de la recette.
        db: Session SQLAlchemy injectée.

    Returns:
        La recette correspondante.

    Raises:
        HTTPException: 404 si non trouvée.
    """
    return _get_or_404(db, recipe_id)


@router.put("/{recipe_id}", response_model=RecipeDetail)
def update_recipe(
    recipe_id: int,
    payload: RecipeUpdate,
    db: Session = Depends(get_db),
) -> Recipe:
    """Met à jour une recette existante (et remplace ses ingrédients si fournis).

    Args:
        recipe_id: Identifiant de la recette.
        payload: Champs à mettre à jour (partiel).
        db: Session SQLAlchemy injectée.

    Returns:
        La recette mise à jour.

    Raises:
        HTTPException: 404 si la recette n'existe pas.
    """
    recipe = _get_or_404(db, recipe_id)
    data = payload.model_dump(exclude_unset=True)
    new_ingredients = data.pop("ingredients", None)
    for key, value in data.items():
        setattr(recipe, key, value)
    if new_ingredients is not None:
        recipe.ingredients = [RecipeIngredient(**ing) for ing in new_ingredients]
    db.commit()
    db.refresh(recipe)
    return recipe


@router.delete("/{recipe_id}")
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)) -> dict:
    """Supprime une recette et ses ingrédients en cascade.

    Args:
        recipe_id: Identifiant de la recette.
        db: Session SQLAlchemy injectée.

    Returns:
        Dictionnaire ``{"ok": True}`` en cas de succès.

    Raises:
        HTTPException: 404 si la recette n'existe pas.
    """
    recipe = _get_or_404(db, recipe_id)
    db.delete(recipe)
    db.commit()
    return {"ok": True}
