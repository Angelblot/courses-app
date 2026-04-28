"""Modèles SQLAlchemy pour les aliments génériques et leurs associations produits."""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Food(Base):
    """Aliment générique, indépendant de toute marque ou conditionnement.

    Représente le "quoi" (quoi acheter ?) avant le "qui" (quelle marque ?).
    Exemples : "Lardons", "Œufs", "Pâtes", "Crème fraîche".
    """

    __tablename__ = "foods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    default_unit: Mapped[Optional[str]] = mapped_column(String(20), default="g", nullable=True)
    synonyms: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class FoodProduct(Base):
    """Association entre un aliment générique et un produit du catalogue.

    Permet de lier plusieurs produits (marques, conditionnements) à un même aliment,
    avec une priorité et un choix préféré.
    """

    __tablename__ = "food_products"

    __table_args__ = (
        UniqueConstraint("food_id", "product_id", name="uq_food_product"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    food_id: Mapped[int] = mapped_column(
        ForeignKey("foods.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    priority: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    is_preferred: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
