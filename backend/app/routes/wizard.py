from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.product import Product
from app.schemas.equivalent import WizardPlanItem
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
