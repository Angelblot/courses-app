#!/usr/bin/env python3
"""Migration P2 — ajoute brand_type/store_brand_affinity et product_equivalents.

Idempotent : peut être ré-exécuté sans erreur. Pour chaque produit existant,
``infer_brand_type`` est appelé pour backfiller ``brand_type`` et
``store_brand_affinity`` à partir du libellé ``brand``.

Usage::

    python -m scripts.migrate_p2_brand_type
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

from app.core.database import SessionLocal, engine
from app.services.product import infer_brand_type


PRODUCTS_NEW_COLUMNS = (
    ("brand_type", "TEXT NOT NULL DEFAULT 'common'"),
    ("store_brand_affinity", "TEXT"),
)


CREATE_EQUIVALENTS_SQL = """
CREATE TABLE IF NOT EXISTS product_equivalents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    drive_name VARCHAR(50) NOT NULL,
    search_query TEXT NOT NULL,
    expected_brand VARCHAR(100),
    expected_ean13 VARCHAR(13),
    last_confirmed_at DATETIME,
    CONSTRAINT uq_product_equivalent_drive UNIQUE (product_id, drive_name)
)
"""

CREATE_EQUIVALENTS_INDEX_SQL = (
    "CREATE INDEX IF NOT EXISTS ix_product_equivalents_product_id "
    "ON product_equivalents (product_id)"
)


def existing_columns(conn, table: str) -> set[str]:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {row[1] for row in rows}


def add_missing_columns(conn) -> None:
    cols = existing_columns(conn, "products")
    for name, ddl in PRODUCTS_NEW_COLUMNS:
        if name in cols:
            print(f"  · colonne products.{name} déjà présente")
            continue
        print(f"  + ajout colonne products.{name}")
        conn.execute(text(f"ALTER TABLE products ADD COLUMN {name} {ddl}"))


def create_equivalents_table(conn) -> None:
    print("  · création table product_equivalents (si absente)")
    conn.execute(text(CREATE_EQUIVALENTS_SQL))
    conn.execute(text(CREATE_EQUIVALENTS_INDEX_SQL))


def backfill_brand_type() -> None:
    db = SessionLocal()
    try:
        rows = db.execute(
            text("SELECT id, brand, brand_type, store_brand_affinity FROM products")
        ).fetchall()
        updated = 0
        for row in rows:
            product_id, brand, current_type, current_affinity = row
            inferred_type, inferred_affinity = infer_brand_type(brand)
            # Ne réécrit que si non explicitement défini par l'utilisateur.
            if current_type and current_type != "common":
                continue
            if current_type == inferred_type and current_affinity == inferred_affinity:
                continue
            db.execute(
                text(
                    "UPDATE products "
                    "SET brand_type = :bt, store_brand_affinity = :sba "
                    "WHERE id = :id"
                ),
                {
                    "bt": inferred_type,
                    "sba": inferred_affinity,
                    "id": product_id,
                },
            )
            updated += 1
        db.commit()
        print(f"  · backfill : {updated} produits mis à jour sur {len(rows)}")
    finally:
        db.close()


def main() -> None:
    print("Migration P2 — brand_type + product_equivalents")
    with engine.begin() as conn:
        add_missing_columns(conn)
        create_equivalents_table(conn)
    backfill_brand_type()
    print("Terminé.")


if __name__ == "__main__":
    main()
