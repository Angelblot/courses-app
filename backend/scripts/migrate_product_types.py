#!/usr/bin/env python3
"""Migre les product_types de tous les produits existants."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal
from app.models.product import Product
from app.services.product_typology import normalize_product_type


def migrate_product_types(dry_run: bool = False):
    db = SessionLocal()
    try:
        products = db.query(Product).all()
        count = 0
        for p in products:
            ptype = normalize_product_type(p.name)
            if ptype and ptype != p.product_type:
                if not dry_run:
                    p.product_type = ptype
                count += 1

        if not dry_run:
            db.commit()

        print(f"OK: {count} produits mis a jour avec un product_type")

        # Afficher quelques exemples
        if count > 0 and dry_run:
            examples = [
                (p.name[:40], normalize_product_type(p.name))
                for p in products[:10]
            ]
            for name, ptype in examples:
                print(f"  {name:40s} -> {ptype}")

    finally:
        db.close()


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    migrate_product_types(dry_run=dry_run)
