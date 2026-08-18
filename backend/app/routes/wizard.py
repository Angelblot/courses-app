"""Routes du wizard : plan de génération + sessions persistantes."""
import json
from typing import Dict, List, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.list_item import ListItem
from app.models.product import Product
from app.models.recipe import Recipe
from app.models.shopping_list import ShoppingList
from app.models.wizard_session import WizardSession
from app.schemas.equivalent import WizardPlanItem
from app.schemas.wizard import (
    WizardConsolidatedItem,
    WizardGenerateRequest,
    WizardResultsOut,
    WizardSessionCreate,
    WizardSessionOut,
)
from app.services.search_strategy import SearchStrategyService

router = APIRouter()


@router.get("/plan", response_model=List[WizardPlanItem])
def wizard_plan(drive: str = "carrefour", db: Session = Depends(get_db)):
    """Renvoie le plan de génération pour les produits favoris.

    Pour chaque produit favori, calcule la requête de recherche optimale et
    son niveau de confiance (``high`` si un equivalent confirmé < 30 jours
    existe, ``low`` sinon).

    Args:
        drive: Drive cible (``carrefour``, ``leclerc``...).
        db: Session SQLAlchemy injectée.

    Returns:
        Liste de ``WizardPlanItem`` à scraper.
    """
    stmt = select(Product).where(Product.favorite == True)  # noqa: E712
    products = db.execute(stmt).scalars().all()
    svc = SearchStrategyService(db)
    return svc.plan_generation([p.id for p in products], drive)


def _consolidate(
    payload: WizardSessionCreate, db: Session
) -> List[WizardConsolidatedItem]:
    """Agrège recettes (× servings), quotidien et extras en lignes uniques.

    La clé d'agrégation est ``(name.lower(), unit, product_id)`` afin de
    fusionner deux ingrédients identiques venant de recettes différentes tout
    en gardant distincts les items dont l'unité diffère.

    Args:
        payload: Données saisies dans le wizard.
        db: Session SQLAlchemy pour charger les recettes/produits référencés.

    Returns:
        Liste consolidée d'items prête à être pousée vers les drives.
    """
    bucket: Dict[Tuple[str, str, int], WizardConsolidatedItem] = {}

    def _add(item: WizardConsolidatedItem) -> None:
        key = (item.name.lower().strip(), item.unit, item.product_id or 0)
        if key in bucket:
            bucket[key].quantity += item.quantity
        else:
            bucket[key] = item

    for r in payload.recipes:
        recipe = db.get(Recipe, r.recipe_id)
        if recipe is None:
            continue
        for ing in recipe.ingredients:
            _add(
                WizardConsolidatedItem(
                    name=ing.name,
                    quantity=float(ing.quantity_per_serving) * r.servings,
                    unit=ing.unit,
                    rayon=ing.rayon,
                    category=ing.category,
                    product_id=ing.product_id,
                )
            )

    for q in payload.quotidien:
        if not q.needed:
            continue
        product = db.get(Product, q.product_id)
        if product is None:
            continue
        _add(
            WizardConsolidatedItem(
                name=product.name,
                quantity=float(q.quantity),
                unit=product.unit,
                rayon=None,
                category=product.category,
                product_id=product.id,
            )
        )

    for extra in payload.extras:
        _add(
            WizardConsolidatedItem(
                name=extra.name,
                quantity=float(extra.quantity),
                unit=extra.unit,
                rayon=extra.rayon,
                category=extra.category,
                product_id=None,
            )
        )

    return list(bucket.values())


def _session_to_out(session: WizardSession) -> WizardSessionOut:
    """Sérialise une ``WizardSession`` en réponse API."""
    raw_payload = json.loads(session.payload)
    payload_model = WizardSessionCreate.model_validate(raw_payload)
    consolidated_raw = raw_payload.get("consolidated_items", [])
    consolidated = [
        WizardConsolidatedItem.model_validate(item) for item in consolidated_raw
    ]
    return WizardSessionOut(
        id=session.id,
        status=session.status,
        created_at=session.created_at,
        updated_at=session.updated_at,
        payload=payload_model,
        consolidated_items=consolidated,
    )


@router.post(
    "/sessions", response_model=WizardSessionOut, status_code=status.HTTP_201_CREATED
)
def create_session(
    payload: WizardSessionCreate, db: Session = Depends(get_db)
) -> WizardSessionOut:
    """Crée une session wizard et calcule la liste consolidée d'items.

    Args:
        payload: Recettes, quotidien et extras saisis par l'utilisateur.
        db: Session SQLAlchemy injectée.

    Returns:
        La session créée avec son ``id`` et la liste consolidée.
    """
    consolidated = _consolidate(payload, db)
    stored = {
        **payload.model_dump(),
        "consolidated_items": [item.model_dump() for item in consolidated],
    }
    session = WizardSession(
        payload=json.dumps(stored, ensure_ascii=False),
        status="pending",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_to_out(session)


@router.get("/sessions/{session_id}", response_model=WizardSessionOut)
def get_session(session_id: int, db: Session = Depends(get_db)) -> WizardSessionOut:
    """Récupère une session wizard par son identifiant.

    Args:
        session_id: Identifiant de la session.
        db: Session SQLAlchemy injectée.

    Returns:
        La session correspondante.

    Raises:
        HTTPException: 404 si la session n'existe pas.
    """
    session = db.get(WizardSession, session_id)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session non trouvée")
    return _session_to_out(session)


@router.post("/sessions/{session_id}/generate")
def generate_session(
    session_id: int,
    payload: WizardGenerateRequest,
    db: Session = Depends(get_db),
) -> Dict:
    """Crée la ``ShoppingList`` + ``ListItems`` à partir d'une session.

    On parcourt les items consolidés ; ceux liés à un produit du catalogue
    sont insérés en ``ListItem``. Les items sans produit (extras libres)
    sont conservés dans ``drive_results`` pour traitement ultérieur côté UI.

    Args:
        session_id: Identifiant de la session wizard.
        payload: Drives sélectionnés pour la génération.
        db: Session SQLAlchemy injectée.

    Returns:
        ``{"job_id": str, "list_id": int, "drives": [...]}``.

    Raises:
        HTTPException: 404 si la session n'existe pas.
    """
    session = db.get(WizardSession, session_id)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session non trouvée")

    raw_payload = json.loads(session.payload)
    consolidated_items = raw_payload.get("consolidated_items", [])

    shopping_list = ShoppingList(name=f"Wizard #{session.id}", status="active")
    db.add(shopping_list)
    db.flush()

    missing_items: List[Dict] = []
    for item in consolidated_items:
        product_id = item.get("product_id")
        if product_id:
            db.add(
                ListItem(
                    shopping_list_id=shopping_list.id,
                    product_id=product_id,
                    quantity=max(1, int(round(float(item.get("quantity") or 0)))),
                )
            )
        else:
            missing_items.append(item)

    job_id = f"wizard-{session.id}"
    drive_results = {
        drive: {"items": [], "missing": missing_items, "total": 0.0}
        for drive in payload.drives
    }
    session.status = "generating"
    session.drive_results = json.dumps(
        {"job_id": job_id, "list_id": shopping_list.id, "drives": drive_results},
        ensure_ascii=False,
    )
    db.commit()

    return {
        "job_id": job_id,
        "list_id": shopping_list.id,
        "drives": payload.drives,
    }


@router.get("/sessions/{session_id}/results", response_model=WizardResultsOut)
def get_session_results(
    session_id: int, db: Session = Depends(get_db)
) -> WizardResultsOut:
    """Renvoie les items groupés par drive pour une session.

    Args:
        session_id: Identifiant de la session wizard.
        db: Session SQLAlchemy injectée.

    Returns:
        Un ``WizardResultsOut`` avec un sous-objet par drive demandé.

    Raises:
        HTTPException: 404 si la session n'existe pas.
    """
    session = db.get(WizardSession, session_id)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session non trouvée")

    drives: Dict[str, Dict] = {}
    if session.drive_results:
        stored = json.loads(session.drive_results)
        drives = stored.get("drives", {})

    return WizardResultsOut(
        session_id=session.id,
        status=session.status,
        drives=drives,
    )
