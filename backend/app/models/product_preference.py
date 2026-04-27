"""Modèle pour les préférences utilisateur produit-ingrédient."""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserProductPreference(Base):
    """Enregistre la préférence d'un utilisateur pour un produit pour un ingrédient donné.

    Permet au système d'apprendre quel produit l'utilisateur choisit
    habituellement pour un ingrédient spécifique.
    """

    __tablename__ = "user_product_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ingredient_name: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    last_selected: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "ingredient_name",
            "product_id",
            name="uq_ingredient_product_preference",
        ),
    )
