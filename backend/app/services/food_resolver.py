"""Service de résolution aliment → meilleur produit.

Pont entre la couche ALIMENT (foods) et la couche PRODUIT (products).
Utilisé par le wizard pour déterminer quel produit associer à un ingrédient
de recette (via son food_id).
"""

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.food import Food, FoodProduct
from app.models.product import Product


class FoodResolver:
    """Service de résolution d'un aliment vers le meilleur produit disponible."""

    def __init__(self, db: Session):
        self.db = db

    def resolve_best_product(self, food_id: int) -> Optional[int]:
        """Trouve le meilleur ``product_id`` pour un ``food_id`` donné.

        Ordre de priorité :
        1. Produit préféré (``is_preferred = True``)
        2. Produit avec la plus haute priorité (``priority`` la plus basse)
        3. ``None`` si aucun produit associé

        Args:
            food_id: Identifiant de l'aliment (``Food.id``).

        Returns:
            ``product_id`` du meilleur produit, ou ``None`` si aucun.
        """
        # 1. Produit préféré
        fp = self.db.execute(
            select(FoodProduct).where(
                FoodProduct.food_id == food_id,
                FoodProduct.is_preferred == True,  # noqa: E712
            )
        ).scalar_one_or_none()
        if fp:
            return fp.product_id

        # 2. Priorité la plus haute (chiffre le plus bas)
        fp = self.db.execute(
            select(FoodProduct)
            .where(FoodProduct.food_id == food_id)
            .order_by(FoodProduct.priority.asc())
            .limit(1)
        ).scalar_one_or_none()
        if fp:
            return fp.product_id

        # 3. Aucun produit associé
        return None

    def resolve_preferred_product(self, food_id: int) -> Optional[Product]:
        """Trouve le produit préféré (ou le mieux noté) pour un aliment.

        Retourne l'instance ``Product`` complète, ou ``None``.

        Args:
            food_id: Identifiant de l'aliment.

        Returns:
            Instance ``Product`` ou ``None``.
        """
        product_id = self.resolve_best_product(food_id)
        if product_id is None:
            return None
        return self.db.get(Product, product_id)
