"""Seed automatique des recettes par défaut.

Insère 5 recettes de démarrage si la table ``recipes`` est vide. Utilisé sur
Render free (disque non persistant) pour garantir une UI démo non vide après
chaque cold start.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.food import Food
from app.models.product import Product
from app.models.recipe import Recipe, RecipeIngredient


# Chaque ingrédient référence un fragment de nom produit (recherché en
# ``ILIKE %fragment%``) ou ``None`` si aucun produit du catalogue ne convient.
DEFAULT_RECIPES: List[Dict[str, object]] = [
    {
        "name": "Poulet rôti aux légumes",
        "description": "Plat familial du dimanche, doré au four avec pommes de terre et oignons.",
        "category": "Plat",
        "servings_default": 4,
        "image_url": "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&w=1200&q=80",
        "ingredients": [
            {"product_match": "Filets de poulet jaune", "name": "Filets de poulet jaune", "quantity_per_serving": 200, "unit": "g", "rayon": "Boucherie"},
            {"product_match": "Pommes de terre", "name": "Pommes de terre", "quantity_per_serving": 250, "unit": "g", "rayon": "Fruits & légumes"},
            {"product_match": "Oignons jaunes", "name": "Oignons jaunes", "quantity_per_serving": 1, "unit": "pièce", "rayon": "Fruits & légumes"},
            {"product_match": None, "name": "Huile d'olive", "quantity_per_serving": 1, "unit": "c. à soupe", "rayon": "Épicerie"},
            {"product_match": None, "name": "Thym", "quantity_per_serving": 1, "unit": "pincée", "rayon": "Épicerie"},
        ],
    },
    {
        "name": "Gratin dauphinois",
        "description": "Gratin crémeux de pommes de terre, ail et fromage râpé, cuit lentement au four.",
        "category": "Accompagnement",
        "servings_default": 4,
        "image_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80",
        "ingredients": [
            {"product_match": "Pommes de terre", "name": "Pommes de terre", "quantity_per_serving": 200, "unit": "g", "rayon": "Fruits & légumes"},
            {"product_match": "Crème Fraîche", "name": "Crème fraîche", "quantity_per_serving": 80, "unit": "g", "rayon": "Produits laitiers"},
            {"product_match": "Lait Demi-Ecrémé", "name": "Lait", "quantity_per_serving": 80, "unit": "ml", "rayon": "Produits laitiers"},
            {"product_match": None, "name": "Ail", "quantity_per_serving": 1, "unit": "gousse", "rayon": "Fruits & légumes"},
            {"product_match": "Emmental râpé", "name": "Fromage râpé", "quantity_per_serving": 30, "unit": "g", "rayon": "Produits laitiers"},
            {"product_match": None, "name": "Sel", "quantity_per_serving": 1, "unit": "pincée", "rayon": "Épicerie"},
        ],
    },
    {
        "name": "Salade César",
        "description": "Salade verte croquante, poulet grillé, parmesan et croûtons façon César.",
        "category": "Entrée",
        "servings_default": 2,
        "image_url": "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&w=1200&q=80",
        "ingredients": [
            {"product_match": None, "name": "Salade verte", "quantity_per_serving": 80, "unit": "g", "rayon": "Fruits & légumes"},
            {"product_match": "Filets de poulet jaune", "name": "Filets de poulet", "quantity_per_serving": 120, "unit": "g", "rayon": "Boucherie"},
            {"product_match": "Parmigiano Reggiano râpé", "name": "Parmesan", "quantity_per_serving": 20, "unit": "g", "rayon": "Produits laitiers"},
            {"product_match": None, "name": "Croûtons", "quantity_per_serving": 20, "unit": "g", "rayon": "Épicerie"},
            {"product_match": None, "name": "Sauce César", "quantity_per_serving": 2, "unit": "c. à soupe", "rayon": "Épicerie"},
        ],
    },
    {
        "name": "Pâtes à la carbonara",
        "description": "La vraie carbonara crémeuse aux lardons fumés et œufs, sans crème ajoutée.",
        "category": "Plat",
        "servings_default": 4,
        "image_url": "https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&w=1200&q=80",
        "ingredients": [
            {"product_match": "Pâtes spaghetti", "name": "Pâtes spaghetti", "quantity_per_serving": 100, "unit": "g", "rayon": "Épicerie"},
            {"product_match": "Lardons fumés", "name": "Lardons fumés", "quantity_per_serving": 60, "unit": "g", "rayon": "Charcuterie"},
            {"product_match": "Œufs Plein Air", "name": "Œufs", "quantity_per_serving": 1, "unit": "pièce", "rayon": "Produits laitiers"},
            {"product_match": "Parmigiano Reggiano râpé", "name": "Parmesan râpé", "quantity_per_serving": 20, "unit": "g", "rayon": "Produits laitiers"},
            {"product_match": "Crème Fraîche", "name": "Crème fraîche", "quantity_per_serving": 30, "unit": "g", "rayon": "Produits laitiers"},
        ],
    },
    {
        "name": "Crêpes sucrées",
        "description": "Pâte à crêpes maison facile, légère et beurrée, parfaite pour le goûter.",
        "category": "Dessert",
        "servings_default": 6,
        "image_url": "https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=1200&q=80",
        "ingredients": [
            {"product_match": None, "name": "Farine", "quantity_per_serving": 50, "unit": "g", "rayon": "Épicerie"},
            {"product_match": "Œufs Plein Air", "name": "Œufs", "quantity_per_serving": 1, "unit": "pièce", "rayon": "Produits laitiers"},
            {"product_match": "Lait Demi-Ecrémé", "name": "Lait", "quantity_per_serving": 100, "unit": "ml", "rayon": "Produits laitiers"},
            {"product_match": None, "name": "Beurre", "quantity_per_serving": 10, "unit": "g", "rayon": "Produits laitiers"},
            {"product_match": None, "name": "Sucre", "quantity_per_serving": 15, "unit": "g", "rayon": "Épicerie"},
        ],
    },
]


def _find_product_id(db: Session, fragment: Optional[str]) -> Optional[int]:
    if not fragment:
        return None
    stmt = (
        select(Product.id)
        .where(func.lower(Product.name).like(f"%{fragment.lower()}%"))
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


def _find_food_id(db: Session, name: str) -> Optional[int]:
    """Trouve le food_id correspondant à un nom d'ingrédient.

    Cherche d'abord un match exact, puis un match LIKE.
    """
    from sqlalchemy import func
    normalized = name.strip().lower()
    food = db.execute(
        select(Food.id).where(func.lower(Food.name) == normalized)
    ).scalar_one_or_none()
    if food:
        return food
    # Fallback LIKE
    food = db.execute(
        select(Food.id).where(func.lower(Food.name).like(f"%{normalized}%"))
    ).scalar_one_or_none()
    return food


def seed_recipes(db: Session) -> int:
    """Insère les recettes par défaut si la table est vide.

    Args:
        db: Session SQLAlchemy.

    Returns:
        Nombre de recettes insérées (0 si la table contenait déjà des données).
    """
    if db.query(Recipe).count() > 0:
        return 0

    for spec in DEFAULT_RECIPES:
        recipe = Recipe(
            name=spec["name"],
            description=spec["description"],
            category=spec["category"],
            servings_default=spec["servings_default"],
            image_url=spec["image_url"],
        )
        for ing in spec["ingredients"]:
            recipe.ingredients.append(
                RecipeIngredient(
                    food_id=_find_food_id(db, ing["name"]),
                    product_id=_find_product_id(db, ing.get("product_match")),
                    name=ing["name"],
                    quantity_per_serving=ing["quantity_per_serving"],
                    unit=ing["unit"],
                    rayon=ing.get("rayon"),
                )
            )
        db.add(recipe)

    db.commit()
    return len(DEFAULT_RECIPES)
