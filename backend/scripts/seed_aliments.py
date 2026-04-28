#!/usr/bin/env python3
"""Seed les aliments depuis les ingrédients de recettes.

Usage:
    python scripts/seed_aliments.py          # seed les aliments + associe
    python scripts/seed_aliments.py --dry-run  # simulation
"""

import sys
import argparse
import json
from pathlib import Path
from typing import Dict
from datetime import datetime

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, text, Column, Integer, String, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base

Base = declarative_base()

class Food(Base):
    __tablename__ = "foods"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False, unique=True)
    category = Column(String(100), nullable=True)
    default_unit = Column(String(20), nullable=True)
    synonyms = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class FoodProduct(Base):
    __tablename__ = "food_products"
    id = Column(Integer, primary_key=True, autoincrement=True)
    food_id = Column(Integer, ForeignKey("foods.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    priority = Column(Integer, default=0)
    is_preferred = Column(Boolean, default=False)


def seed_aliments(db_path: str, dry_run: bool = False):
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        rows = session.execute(text("""
            SELECT DISTINCT ri.name, ri.category_hint, ri.product_id, p.category as prod_category
            FROM recipe_ingredients ri
            LEFT JOIN products p ON p.id = ri.product_id
            ORDER BY ri.name
        """)).fetchall()

        if not rows:
            print("Aucun ingredient trouve dans recipe_ingredients")
            return

        print(f"{len(rows)} ingredients uniques trouves")

        food_map: Dict[str, Food] = {}
        for row in rows:
            name = row[0].strip().lower()
            if name not in food_map:
                food = Food(
                    name=row[0].strip(),
                    category=row[1] if row[1] else None,
                    default_unit="g" if row[1] in ("charcuterie", "epicerie", "boucherie") else None,
                    synonyms=json.dumps([]),
                )
                if not dry_run:
                    session.add(food)
                    session.flush()
                food_map[name] = food
                print(f"  Aliment cree: {food.name} (cat: {food.category})")

        session.commit()

        # Associer les produits
        print("\nAssociation aliments <-> produits...")
        assoc_count = 0
        for row in rows:
            name = row[0].strip().lower()
            product_id = row[2]
            food = food_map.get(name)
            if not food or not product_id:
                continue
            fp = FoodProduct(food_id=food.id, product_id=product_id, priority=0)
            if not dry_run:
                session.add(fp)
            assoc_count += 1

        session.commit()
        print(f"  {assoc_count} associations creees")

        # Mettre a jour food_id dans recipe_ingredients
        print("\nMise a jour de food_id dans recipe_ingredients...")
        updated = 0
        for row in rows:
            name = row[0].strip().lower()
            food = food_map.get(name)
            if not food:
                continue
            if not dry_run:
                session.execute(
                    text("UPDATE recipe_ingredients SET food_id = :fid WHERE LOWER(TRIM(name)) = :n"),
                    {"fid": food.id, "n": name}
                )
            updated += 1

        session.commit()
        print(f"  {updated} recipe_ingredients mis a jour")

        food_count = session.execute(text("SELECT COUNT(*) FROM foods")).scalar()
        fp_count = session.execute(text("SELECT COUNT(*) FROM food_products")).scalar()
        print(f"\nResume: {food_count} aliments, {fp_count} associations produit")

    finally:
        session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed les aliments depuis les ingredients")
    parser.add_argument("--db", default="backend/app.db", help="Chemin vers la DB")
    parser.add_argument("--dry-run", action="store_true", help="Simulation sans ecriture")
    args = parser.parse_args()
    seed_aliments(args.db, dry_run=args.dry_run)
