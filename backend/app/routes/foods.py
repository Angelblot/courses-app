"""Routes CRUD pour la gestion des aliments génériques et leurs associations produits."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.food import Food, FoodProduct
from app.models.product import Product
from app.schemas.food import (
    FoodCreate,
    FoodOut,
    FoodProductCreate,
    FoodProductOut,
    FoodUpdate,
)

router = APIRouter()


def _get_food_or_404(db: Session, food_id: int) -> Food:
    """Récupère un aliment ou lève 404."""
    food = db.get(Food, food_id)
    if food is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Aliment non trouvé")
    return food


def _enrich_food_product(fp: FoodProduct, db: Session) -> FoodProductOut:
    """Enrichit un FoodProduct avec les infos du produit associé."""
    product = db.get(Product, fp.product_id)
    return FoodProductOut(
        id=fp.id,
        food_id=fp.food_id,
        product_id=fp.product_id,
        priority=fp.priority,
        is_preferred=fp.is_preferred,
        created_at=fp.created_at,
        product_name=product.name if product else None,
        product_image_url=product.image_url if product else None,
        product_brand=product.brand if product else None,
        product_category=product.category if product else None,
        product_unit=product.unit if product else None,
        product_grammage_g=product.grammage_g if product else None,
        product_volume_ml=product.volume_ml if product else None,
        product_brand_type=product.brand_type if product else None,
    )


@router.get("/", response_model=List[FoodOut])
def list_foods(
    category: Optional[str] = Query(None, max_length=100),
    search: Optional[str] = Query(None, max_length=255),
    db: Session = Depends(get_db),
) -> List[FoodOut]:
    """Liste tous les aliments, avec filtre optionnel par catégorie ou recherche textuelle.

    Args:
        category: Filtre par catégorie.
        search: Recherche textuelle dans le nom.
        db: Session SQLAlchemy injectée.

    Returns:
        Liste des aliments avec leurs produits associés.
    """
    stmt = select(Food).order_by(Food.name.asc())

    if category:
        stmt = stmt.where(Food.category == category)
    if search:
        pattern = f"%{search.lower()}%"
        stmt = stmt.where(Food.name.ilike(pattern))

    foods = list(db.execute(stmt).scalars().all())

    result = []
    for food in foods:
        # Charger les associations
        fp_stmt = select(FoodProduct).where(FoodProduct.food_id == food.id).order_by(FoodProduct.priority.asc())
        food_products = list(db.execute(fp_stmt).scalars().all())
        result.append(FoodOut(
            id=food.id,
            name=food.name,
            category=food.category,
            default_unit=food.default_unit,
            synonyms=food.synonyms,
            image_url=food.image_url,
            created_at=food.created_at,
            updated_at=food.updated_at,
            products=[_enrich_food_product(fp, db) for fp in food_products],
        ))

    return result


@router.get("/{food_id}", response_model=FoodOut)
def get_food(food_id: int, db: Session = Depends(get_db)) -> FoodOut:
    """Détail d'un aliment avec ses produits associés.

    Args:
        food_id: Identifiant de l'aliment.
        db: Session SQLAlchemy injectée.

    Returns:
        L'aliment avec sa liste de produits associés.

    Raises:
        HTTPException: 404 si l'aliment n'existe pas.
    """
    food = _get_food_or_404(db, food_id)
    fp_stmt = select(FoodProduct).where(FoodProduct.food_id == food.id).order_by(FoodProduct.priority.asc())
    food_products = list(db.execute(fp_stmt).scalars().all())
    return FoodOut(
        id=food.id,
        name=food.name,
        category=food.category,
        default_unit=food.default_unit,
        synonyms=food.synonyms,
        image_url=food.image_url,
        created_at=food.created_at,
        updated_at=food.updated_at,
        products=[_enrich_food_product(fp, db) for fp in food_products],
    )


@router.post("/", response_model=FoodOut, status_code=status.HTTP_201_CREATED)
def create_food(payload: FoodCreate, db: Session = Depends(get_db)) -> FoodOut:
    """Crée un nouvel aliment.

    Args:
        payload: Données de l'aliment à créer.
        db: Session SQLAlchemy injectée.

    Returns:
        L'aliment créé.

    Raises:
        HTTPException: 409 si le nom existe déjà.
    """
    # Vérifier unicité
    existing = db.execute(select(Food).where(Food.name == payload.name)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Un aliment nommé '{payload.name}' existe déjà",
        )

    food = Food(
        name=payload.name,
        category=payload.category,
        default_unit=payload.default_unit,
        synonyms=payload.synonyms,
        image_url=payload.image_url,
    )
    db.add(food)
    db.commit()
    db.refresh(food)

    return FoodOut(
        id=food.id,
        name=food.name,
        category=food.category,
        default_unit=food.default_unit,
        synonyms=food.synonyms,
        image_url=food.image_url,
        created_at=food.created_at,
        updated_at=food.updated_at,
        products=[],
    )


@router.put("/{food_id}", response_model=FoodOut)
def update_food(food_id: int, payload: FoodUpdate, db: Session = Depends(get_db)) -> FoodOut:
    """Met à jour un aliment existant.

    Args:
        food_id: Identifiant de l'aliment.
        payload: Champs à mettre à jour.
        db: Session SQLAlchemy injectée.

    Returns:
        L'aliment mis à jour.

    Raises:
        HTTPException: 404 si l'aliment n'existe pas.
    """
    food = _get_food_or_404(db, food_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(food, key, value)
    db.commit()
    db.refresh(food)

    fp_stmt = select(FoodProduct).where(FoodProduct.food_id == food.id).order_by(FoodProduct.priority.asc())
    food_products = list(db.execute(fp_stmt).scalars().all())
    return FoodOut(
        id=food.id,
        name=food.name,
        category=food.category,
        default_unit=food.default_unit,
        synonyms=food.synonyms,
        image_url=food.image_url,
        created_at=food.created_at,
        updated_at=food.updated_at,
        products=[_enrich_food_product(fp, db) for fp in food_products],
    )


@router.delete("/{food_id}")
def delete_food(food_id: int, db: Session = Depends(get_db)) -> dict:
    """Supprime un aliment.

    Args:
        food_id: Identifiant de l'aliment.
        db: Session SQLAlchemy injectée.

    Returns:
        ``{"ok": True}`` en cas de succès.

    Raises:
        HTTPException: 404 si l'aliment n'existe pas.
    """
    food = _get_food_or_404(db, food_id)
    db.delete(food)
    db.commit()
    return {"ok": True}


@router.get("/{food_id}/products", response_model=List[FoodProductOut])
def list_food_products(food_id: int, db: Session = Depends(get_db)) -> List[FoodProductOut]:
    """Liste les produits associés à un aliment.

    Args:
        food_id: Identifiant de l'aliment.
        db: Session SQLAlchemy injectée.

    Returns:
        Liste des associations aliment↔produit.

    Raises:
        HTTPException: 404 si l'aliment n'existe pas.
    """
    _get_food_or_404(db, food_id)
    stmt = select(FoodProduct).where(FoodProduct.food_id == food_id).order_by(FoodProduct.priority.asc())
    food_products = list(db.execute(stmt).scalars().all())
    return [_enrich_food_product(fp, db) for fp in food_products]


@router.post("/{food_id}/products", response_model=FoodProductOut, status_code=status.HTTP_201_CREATED)
def associate_product(
    food_id: int,
    payload: FoodProductCreate,
    db: Session = Depends(get_db),
) -> FoodProductOut:
    """Associe un produit à un aliment.

    Si ``is_preferred`` est ``True``, les autres associations pour le même
    aliment sont mises à ``False``.

    Args:
        food_id: Identifiant de l'aliment.
        payload: Données de l'association (product_id, priority, is_preferred).
        db: Session SQLAlchemy injectée.

    Returns:
        L'association créée.

    Raises:
        HTTPException: 404 si l'aliment ou le produit n'existe pas.
        HTTPException: 409 si l'association existe déjà.
    """
    _get_food_or_404(db, food_id)
    product = db.get(Product, payload.product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Produit non trouvé")

    # Vérifier doublon
    existing = db.execute(
        select(FoodProduct).where(
            FoodProduct.food_id == food_id,
            FoodProduct.product_id == payload.product_id,
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Cette association existe déjà",
        )

    # Si is_preferred, retirer les autres préférences pour le même aliment
    if payload.is_preferred:
        others = db.execute(
            select(FoodProduct).where(
                FoodProduct.food_id == food_id,
                FoodProduct.is_preferred == True,  # noqa: E712
                FoodProduct.product_id != payload.product_id,
            )
        ).scalars().all()
        for other in others:
            other.is_preferred = False

    fp = FoodProduct(
        food_id=food_id,
        product_id=payload.product_id,
        priority=payload.priority,
        is_preferred=payload.is_preferred,
    )
    db.add(fp)
    db.commit()
    db.refresh(fp)

    return _enrich_food_product(fp, db)


@router.delete("/{food_id}/products/{product_id}")
def dissociate_product(
    food_id: int,
    product_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Dissocie un produit d'un aliment.

    Args:
        food_id: Identifiant de l'aliment.
        product_id: Identifiant du produit.
        db: Session SQLAlchemy injectée.

    Returns:
        ``{"ok": True}`` en cas de succès.

    Raises:
        HTTPException: 404 si l'association n'existe pas.
    """
    fp = db.execute(
        select(FoodProduct).where(
            FoodProduct.food_id == food_id,
            FoodProduct.product_id == product_id,
        )
    ).scalar_one_or_none()
    if fp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Association non trouvée")
    db.delete(fp)
    db.commit()
    return {"ok": True}
