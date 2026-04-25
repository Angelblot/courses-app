from datetime import datetime, timedelta
from typing import Iterable, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.product_equivalent import ProductEquivalent
from app.schemas.equivalent import WizardPlanItem


CONFIRMATION_WINDOW = timedelta(days=30)


def _normalize(value: Optional[str]) -> str:
    return (value or "").strip()


def build_search_query(product: Product, drive_name: str) -> str:
    """Construit la requête déterministe pour un produit + drive donnés.

    Suit la table de stratégie §4.3 du DESIGN :

    - ``common``                    → ``"{name} {brand}"``.
    - ``store_brand`` + affinity == drive → ``"{name} {brand}"``.
    - ``store_brand`` + affinity != drive → ``"{name}"`` (sans marque).
    - ``generic``                   → ``"{name}"`` (les attributs bio /
      calibre se trouvent déjà dans ``name`` côté seed).

    Args:
        product: Produit local à rechercher.
        drive_name: Nom du drive cible (``carrefour``, ``leclerc``...).

    Returns:
        Requête à envoyer au moteur de recherche du drive.
    """
    name = _normalize(product.name)
    brand = _normalize(product.brand)
    brand_type = product.brand_type or "common"
    affinity = (product.store_brand_affinity or "").lower()
    drive = (drive_name or "").lower()

    if brand_type == "store_brand":
        if affinity and affinity == drive and brand:
            return f"{name} {brand}".strip()
        return name

    if brand_type == "generic":
        return name

    # common (par défaut)
    if brand:
        return f"{name} {brand}".strip()
    return name


def _equivalent_for(
    db: Session, product_id: int, drive_name: str
) -> Optional[ProductEquivalent]:
    stmt = select(ProductEquivalent).where(
        ProductEquivalent.product_id == product_id,
        ProductEquivalent.drive_name == drive_name,
    )
    return db.execute(stmt).scalar_one_or_none()


def _is_recent(eq: ProductEquivalent, *, now: Optional[datetime] = None) -> bool:
    if eq.last_confirmed_at is None:
        return False
    now = now or datetime.utcnow()
    return (now - eq.last_confirmed_at) <= CONFIRMATION_WINDOW


class SearchStrategyService:
    """Plannifie les requêtes de recherche multi-drive.

    Prend en compte les overrides ``product_equivalents`` confirmés < 30 jours,
    sinon retombe sur ``build_search_query``.
    """

    def __init__(self, db: Session):
        self.db = db

    def resolve(self, product: Product, drive_name: str) -> tuple[str, str]:
        """Renvoie ``(search_query, confidence)`` pour un produit + drive."""
        eq = _equivalent_for(self.db, product.id, drive_name)
        if eq and _is_recent(eq):
            return eq.search_query, "high"
        return build_search_query(product, drive_name), "low"

    def plan_generation(
        self, product_ids: Iterable[int], drive: str
    ) -> List[WizardPlanItem]:
        """Plan la génération scraping pour une liste de produits.

        Args:
            product_ids: identifiants des produits à scraper.
            drive: drive cible (``carrefour``, ``leclerc``...).

        Returns:
            Liste de ``WizardPlanItem`` ordonnée selon ``product_ids``.
        """
        ids = [int(pid) for pid in product_ids if pid is not None]
        if not ids:
            return []

        stmt = select(Product).where(Product.id.in_(ids))
        products = {p.id: p for p in self.db.execute(stmt).scalars().unique()}

        plan: List[WizardPlanItem] = []
        for pid in ids:
            product = products.get(pid)
            if product is None:
                continue
            query, confidence = self.resolve(product, drive)
            plan.append(
                WizardPlanItem(
                    product_id=product.id,
                    name=product.name,
                    brand=product.brand,
                    brand_type=product.brand_type or "common",
                    store_brand_affinity=product.store_brand_affinity,
                    search_query=query,
                    confidence=confidence,
                )
            )
        return plan
