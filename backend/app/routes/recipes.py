"""Routes CRUD et import automatique pour les recettes."""
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.recipe import Recipe, RecipeIngredient
from app.schemas.recipe import (
    RecipeCreate,
    RecipeDetail,
    RecipeDraft,
    RecipeImportUrlRequest,
    RecipeOut,
    RecipeUpdate,
)
from app.services.recipe_import import RecipeImportError, import_from_photo, import_from_url

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


@router.post("/import/url", response_model=RecipeDraft)
def import_recipe_from_url(payload: RecipeImportUrlRequest) -> RecipeDraft:
    """Prépare un brouillon de recette depuis un lien (Marmiton, Jow, blog…).

    Le brouillon n'est pas enregistré : l'utilisateur le vérifie puis le
    soumet via ``POST /api/recipes/``.

    Args:
        payload: Lien de la recette.

    Returns:
        Le brouillon pré-rempli.

    Raises:
        HTTPException: 422 avec un message lisible si l'import échoue.
    """
    try:
        return import_from_url(payload.url)
    except RecipeImportError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc


@router.post("/import/photo", response_model=RecipeDraft)
def import_recipe_from_photo(file: UploadFile = File(...)) -> RecipeDraft:
    """Prépare un brouillon de recette depuis la photo d'une fiche recette.

    Args:
        file: Image (JPEG, PNG, WebP) envoyée en multipart.

    Returns:
        Le brouillon pré-rempli.

    Raises:
        HTTPException: 422 avec un message lisible si l'import échoue.
    """
    try:
        return import_from_photo(file.file.read(), file.content_type or "")
    except RecipeImportError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc


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
