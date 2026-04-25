from datetime import datetime
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.product import VALID_BRAND_TYPES, Product
from app.models.product_equivalent import ProductEquivalent
from app.repositories.product import ProductRepository
from app.schemas.product import ProductCreate, ProductUpdate
from app.schemas.purchase_line import ProductPriceHistoryOut, PurchaseLineOut
from app.services.categories import CategoryService


# Marques distributeur reconnues (clé = pattern dans `brand`, valeur = affinité).
STORE_BRAND_PATTERNS: Tuple[Tuple[str, str], ...] = (
    ("carrefour", "carrefour"),
    ("leclerc", "leclerc"),
    ("marque repère", "leclerc"),
    ("marque repere", "leclerc"),
    ("auchan", "auchan"),
    ("monoprix", "monoprix"),
    ("u bio", "systeme_u"),
    ("système u", "systeme_u"),
    ("systeme u", "systeme_u"),
    ("intermarché", "intermarche"),
    ("intermarche", "intermarche"),
    ("casino", "casino"),
)


def infer_brand_type(brand: Optional[str]) -> Tuple[str, Optional[str]]:
    """Infère ``(brand_type, store_brand_affinity)`` à partir du libellé marque.

    Suit la règle d'inférence §4.4 du DESIGN :

    - Marque vide → ``generic``.
    - Marque contenant un nom de distributeur connu → ``store_brand`` +
      affinité associée.
    - Sinon → ``common``.

    Args:
        brand: Libellé brut de la marque tel que stocké en DB.

    Returns:
        Tuple ``(brand_type, store_brand_affinity)``. ``store_brand_affinity``
        est ``None`` sauf pour ``store_brand``.
    """
    if not brand or not brand.strip():
        return "generic", None
    needle = brand.lower()
    for pattern, affinity in STORE_BRAND_PATTERNS:
        if pattern in needle:
            return "store_brand", affinity
    return "common", None


class ProductService:
    def __init__(self, repo: ProductRepository, categories: CategoryService):
        self.repo = repo
        self.categories = categories

    @property
    def db(self) -> Session:
        return self.repo.db

    def _enrich(self, product: Product) -> Product:
        """Attache les champs catégorie canonique (lecture seule) au produit.

        Les valeurs sont posées comme attributs transients — ``from_attributes``
        de Pydantic les sérialise automatiquement dans ``ProductOut``.
        """
        key, label = self.categories.resolve(product.category)
        product.category_key = key
        product.category_label = label
        return product

    def _enrich_all(self, products: List[Product]) -> List[Product]:
        for p in products:
            self._enrich(p)
        return products

    def list(
        self,
        favorite_only: bool = False,
        drive: Optional[str] = None,
    ) -> List[Product]:
        return self._enrich_all(self.repo.list(favorite_only=favorite_only, drive=drive))

    def get(self, product_id: int) -> Product:
        product = self.repo.get(product_id)
        if not product:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Produit non trouvé")
        return self._enrich(product)

    def create(self, data: ProductCreate) -> Product:
        payload = data.model_dump()
        # Si l'utilisateur n'a pas explicité brand_type → inférence heuristique.
        explicit_type = payload.get("brand_type") and payload.get("brand_type") != "common"
        if not explicit_type:
            brand_type, affinity = infer_brand_type(payload.get("brand"))
            payload["brand_type"] = brand_type
            if payload.get("store_brand_affinity") in (None, ""):
                payload["store_brand_affinity"] = affinity

        if payload.get("brand_type") not in VALID_BRAND_TYPES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "brand_type invalide")
        return self._enrich(self.repo.add(Product(**payload)))

    def update(self, product_id: int, data: ProductUpdate) -> Product:
        product = self.get(product_id)
        patch = data.model_dump(exclude_unset=True)

        if "brand_type" in patch and patch["brand_type"] not in VALID_BRAND_TYPES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "brand_type invalide")

        # Si la marque change et que brand_type n'est pas explicitement fourni,
        # on ré-infère pour garder la cohérence.
        if "brand" in patch and "brand_type" not in patch:
            brand_type, affinity = infer_brand_type(patch.get("brand"))
            patch["brand_type"] = brand_type
            if "store_brand_affinity" not in patch:
                patch["store_brand_affinity"] = affinity

        for key, value in patch.items():
            setattr(product, key, value)
        return self._enrich(self.repo.save(product))

    def delete(self, product_id: int) -> None:
        self.repo.delete(self.get(product_id))

    def get_price_history(self, product_id: int) -> ProductPriceHistoryOut:
        self.get(product_id)
        rows = self.repo.get_price_history(product_id)
        points = []
        for line, drive_name in rows:
            item = PurchaseLineOut.model_validate(line)
            item.drive_name = drive_name
            points.append(item)
        return ProductPriceHistoryOut(product_id=product_id, points=points)

    # --- Equivalents -------------------------------------------------------

    def get_equivalents(self, product_id: int) -> List[ProductEquivalent]:
        """Liste les equivalents (cross-drive) connus pour un produit."""
        self.get(product_id)
        stmt = (
            select(ProductEquivalent)
            .where(ProductEquivalent.product_id == product_id)
            .order_by(ProductEquivalent.drive_name)
        )
        return list(self.db.execute(stmt).scalars().all())

    def set_equivalent(
        self,
        product_id: int,
        drive_name: str,
        search_query: str,
        expected_brand: Optional[str] = None,
        expected_ean13: Optional[str] = None,
    ) -> ProductEquivalent:
        """Crée ou met à jour l'equivalent ``(product_id, drive_name)``.

        Met ``last_confirmed_at`` à ``utcnow()`` à chaque écriture : toute
        soumission utilisateur compte comme une confirmation explicite.
        """
        self.get(product_id)
        stmt = select(ProductEquivalent).where(
            ProductEquivalent.product_id == product_id,
            ProductEquivalent.drive_name == drive_name,
        )
        eq = self.db.execute(stmt).scalar_one_or_none()
        now = datetime.utcnow()
        if eq is None:
            eq = ProductEquivalent(
                product_id=product_id,
                drive_name=drive_name,
                search_query=search_query,
                expected_brand=expected_brand,
                expected_ean13=expected_ean13,
                last_confirmed_at=now,
            )
            self.db.add(eq)
        else:
            eq.search_query = search_query
            eq.expected_brand = expected_brand
            eq.expected_ean13 = expected_ean13
            eq.last_confirmed_at = now
        self.db.commit()
        self.db.refresh(eq)
        return eq
