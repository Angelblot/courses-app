"""Seed des aliments génériques (table foods) et associations produits (food_products).

Module importable, version "runtime" du script `backend/scripts/seed_aliments.py`.
Pensé pour être appelé au démarrage de l'app (ex: Render free sans disque persistant).
"""

import json
from typing import Dict

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.food import Food, FoodProduct


def seed_aliments_db(db: Session) -> dict:
    """Seed les aliments depuis ``recipe_ingredients`` et les associe aux produits.

    Idempotent : si la table ``foods`` contient déjà des lignes, ne fait rien.

    Args:
        db: Session SQLAlchemy active.

    Returns:
        Dict résumant l'opération : ``{"foods": n, "associations": n, "ingredients_updated": n}``
        ou ``{"skipped": "already_seeded"}`` si la table est déjà peuplée.
    """
    if db.query(Food).count() > 0:
        return {"skipped": "already_seeded"}

    rows = db.execute(text("""
        SELECT DISTINCT ri.name, ri.category_hint, ri.product_id, p.category as prod_category
        FROM recipe_ingredients ri
        LEFT JOIN products p ON p.id = ri.product_id
        ORDER BY ri.name
    """)).fetchall()

    if not rows:
        return {"skipped": "no_ingredients"}

    food_map: Dict[str, Food] = {}
    for row in rows:
        raw_name = row[0]
        if not raw_name:
            continue
        key = raw_name.strip().lower()
        if key in food_map:
            continue
        category_hint = row[1]
        food = Food(
            name=raw_name.strip(),
            category=category_hint if category_hint else None,
            default_unit="g" if category_hint in ("charcuterie", "epicerie", "boucherie") else None,
            synonyms=json.dumps([]),
        )
        db.add(food)
        db.flush()
        food_map[key] = food

    db.commit()

    assoc_count = 0
    seen_pairs: set[tuple[int, int]] = set()
    for row in rows:
        raw_name = row[0]
        product_id = row[2]
        if not raw_name or not product_id:
            continue
        food = food_map.get(raw_name.strip().lower())
        if not food:
            continue
        pair = (food.id, product_id)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)
        db.add(FoodProduct(food_id=food.id, product_id=product_id, priority=0))
        assoc_count += 1

    db.commit()

    updated = 0
    for key, food in food_map.items():
        result = db.execute(
            text("UPDATE recipe_ingredients SET food_id = :fid WHERE LOWER(TRIM(name)) = :n"),
            {"fid": food.id, "n": key},
        )
        updated += result.rowcount or 0

    db.commit()

    return {
        "foods": len(food_map),
        "associations": assoc_count,
        "ingredients_updated": updated,
    }
