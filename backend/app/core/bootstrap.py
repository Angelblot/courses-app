"""Amorçage de la base : seeds de démarrage et migrations de données.

Ce module existe parce que le hook de démarrage de ``main.py`` avait fini par
accumuler des correctifs de données ponctuels, réexécutés à chaque boot sans
trace ni test. Chaque opération est ici nommée, idempotente et testable
isolément.

Les seeds ne servent qu'aux hébergements sans disque persistant (Render free),
où la base repart vide à chaque déploiement. Ils disparaîtront avec la
migration vers Postgres.
"""

from __future__ import annotations

import logging
import os
from typing import Callable, Dict, List, Tuple

from sqlalchemy.orm import Session

from app.models.product import Product
from app.routes.seed import seed_database
from app.services.categories import seed_categories, seed_category_aliases
from app.services.product_typology import normalize_product_type
from app.services.recipes_seed import seed_recipes

logger = logging.getLogger(__name__)

# Types de produits relevant de la charcuterie, historiquement rangés en
# "P.L.S." (produits laitiers et surgelés) par l'import Carrefour initial.
CHARCUTERIE_TYPES = {"lardon", "jambon", "chorizo", "saucisse", "saucisson"}


def backfill_product_types(db: Session) -> int:
    """Renseigne ``product_type`` pour les produits qui n'en ont pas.

    Args:
        db: Session SQLAlchemy active.

    Returns:
        Nombre de produits mis à jour.
    """
    products = db.query(Product).filter(Product.product_type.is_(None)).all()
    for product in products:
        product.product_type = normalize_product_type(product.name)
    if products:
        db.commit()
    return len(products)


def fix_charcuterie_categories(db: Session) -> int:
    """Reclasse la charcuterie rangée à tort en ``P.L.S.``.

    Args:
        db: Session SQLAlchemy active.

    Returns:
        Nombre de produits reclassés.
    """
    mislabelled = (
        db.query(Product)
        .filter(Product.category == "P.L.S.")
        .filter(Product.product_type.in_(CHARCUTERIE_TYPES))
        .all()
    )
    for product in mislabelled:
        product.category = "CHARCUT.TRAITEUR"
    if mislabelled:
        db.commit()
    return len(mislabelled)


# Migrations de données, dans l'ordre d'application. Le backfill des types doit
# précéder le reclassement, qui s'appuie dessus.
DATA_MIGRATIONS: List[Tuple[str, Callable[[Session], int]]] = [
    ("product_types", backfill_product_types),
    ("charcuterie_categories", fix_charcuterie_categories),
]


def run_data_migrations(db: Session) -> Dict[str, int]:
    """Applique toutes les migrations de données.

    Chaque migration est idempotente : une réexécution sur une base déjà
    migrée ne touche aucune ligne.

    Args:
        db: Session SQLAlchemy active.

    Returns:
        Dictionnaire ``nom de migration`` → nombre de lignes affectées.
    """
    applied: Dict[str, int] = {}
    for name, migration in DATA_MIGRATIONS:
        try:
            count = migration(db)
        except Exception:
            db.rollback()
            logger.exception("Migration '%s' en échec", name)
            continue
        applied[name] = count
        if count:
            logger.info("Migration '%s' : %d ligne(s)", name, count)
    return applied


def run_seeds(db: Session) -> Dict[str, int]:
    """Peuple une base vide (catalogue, catégories, recettes).

    Sans effet si les tables sont déjà remplies. ``SKIP_PRODUCT_SEED=1``
    désactive les seeds de produits et de recettes.

    Args:
        db: Session SQLAlchemy active.

    Returns:
        Dictionnaire ``nom du seed`` → nombre de lignes insérées.
    """
    seeded: Dict[str, int] = {}
    skip_products = os.getenv("SKIP_PRODUCT_SEED") == "1"

    try:
        if not skip_products:
            # seed_database renvoie un compteur par table, pas un total.
            for table, count in (seed_database(db).get("seeded") or {}).items():
                if count:
                    seeded[table] = count

        for name, seed_fn in (
            ("categories", seed_categories),
            ("category_aliases", seed_category_aliases),
        ):
            inserted = seed_fn(db)
            if inserted:
                seeded[name] = inserted

        if not skip_products:
            inserted = seed_recipes(db)
            if inserted:
                seeded["recipes"] = inserted
    except Exception:
        db.rollback()
        logger.exception("Seed initial en échec")

    for name, count in seeded.items():
        logger.info("Seed '%s' : %d ligne(s)", name, count)
    return seeded


def bootstrap(db: Session) -> Dict[str, Dict[str, int]]:
    """Enchaîne seeds puis migrations de données au démarrage.

    Args:
        db: Session SQLAlchemy active.

    Returns:
        ``{"seeds": {...}, "migrations": {...}}``.
    """
    return {"seeds": run_seeds(db), "migrations": run_data_migrations(db)}
