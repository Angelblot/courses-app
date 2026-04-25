#!/usr/bin/env python3
"""Script CLI d'enrichissement des grammages/volumes via Open Food Facts.

Interroge l'API Open Food Facts pour chaque produit possédant un EAN13
mais sans grammage ni volume, et met à jour la base de données.

Usage:
    python scripts/enrich_ean.py
    python scripts/enrich_ean.py --dry-run    # simulation sans écriture
    python scripts/enrich_ean.py --delay 0.5  # délai personnalisé entre requêtes
    python scripts/enrich_ean.py --verbose    # logs détaillés
"""

import argparse
import asyncio
import logging
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Ajouter le parent au PYTHONPATH pour pouvoir importer les modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
from sqlalchemy import select

from app.core.database import SessionLocal, init_db
from app.models.product import Product

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

OFF_API_URL = "https://fr.openfoodfacts.org/api/v2/product/{ean}.json"

# Patterns de détection des liquides
LIQUID_PATTERNS = [
    r"(?i)\blait\b", r"(?i)\bhuile\b", r"(?i)\bcr[eé]me\b",
    r"(?i)\bjus\b", r"(?i)\bsoda\b", r"(?i)\bbi[eè]re\b",
    r"(?i)\bvin\b", r"(?i)\bsauce\b", r"(?i)\bsirop\b",
    r"(?i)\bboisson\b", r"(?i)\blimonade\b", r"(?i)\byaourt\b",
    r"(?i)\byogourt\b", r"(?i)\bfromage\s+frais\b",
    r"(?i)\bsmoothie\b", r"(?i)\beau\b", r"(?i)\b[nN]ectar\b",
    r"(?i)\benergy\s+drink\b",
]

import re


def _is_liquid(name: str, categories: str = "") -> bool:
    text = f"{name} {categories}"
    return any(re.search(p, text) for p in LIQUID_PATTERNS)


async def _fetch_off(client: httpx.AsyncClient, ean: str) -> Optional[Dict]:
    """Interroge l'API OFF et retourne les données produit ou None.

    Gère les rate-limits (HTTP 429) avec retry et backoff exponentiel.
    """
    url = OFF_API_URL.format(ean=ean)
    max_retries = 3
    for attempt in range(max_retries):
        try:
            resp = await client.get(url, timeout=10.0)
            if resp.status_code == 429:
                retry_after = _parse_retry_after(resp) or (2 ** attempt)
                logger.warning("  ⏳ Rate-limit (429) pour EAN %s, nouvelle tentative dans %ds (essai %d/%d)", ean, retry_after, attempt + 1, max_retries)
                await asyncio.sleep(retry_after)
                continue
            if resp.status_code != 200:
                logger.debug("OFF returned %d for EAN %s", resp.status_code, ean)
                return None
            data = resp.json()
            if data.get("status") != 1:
                logger.debug("OFF status != 1 for EAN %s", ean)
                return None
            return data.get("product")
        except httpx.TimeoutException:
            if attempt < max_retries - 1:
                wait = 2 ** attempt
                logger.warning("  ⏱  Timeout EAN %s, nouvelle tentative dans %ds (essai %d/%d)", ean, wait, attempt + 1, max_retries)
                await asyncio.sleep(wait)
                continue
            logger.warning("  ⏱  Timeout définitif pour EAN %s après %d essais", ean, max_retries)
            return None
        except Exception as exc:
            logger.warning("  ⚠  Erreur %s pour EAN %s: %s", type(exc).__name__, ean, exc)
            return None
    return None


def _parse_retry_after(response) -> Optional[int]:
    """Extrait le délai d'attente depuis l'en-tête Retry-After."""
    val = response.headers.get("Retry-After")
    if val:
        try:
            return int(val)
        except ValueError:
            pass
    return None


async def enrich_products(
    dry_run: bool = False,
    delay: float = 1.0,
    verbose: bool = False,
) -> Dict:
    """Exécute l'enrichissement de tous les produits.

    Args:
        dry_run: Si True, ne fait que simuler sans écrire en base.
        delay: Délai en secondes entre chaque requête OFF.
        verbose: Logs détaillés.

    Returns:
        Dictionnaire récapitulatif.
    """
    init_db()
    db = SessionLocal()

    try:
        # Récupérer les produits à enrichir
        stmt = select(Product).where(
            Product.ean13.is_not(None),
            Product.grammage_g.is_(None),
            Product.volume_ml.is_(None),
        )
        products: List[Product] = list(db.execute(stmt).scalars().all())

        total = len(products)
        if total == 0:
            logger.info("✅ Aucun produit à enrichir — tous les grammages sont déjà renseignés.")
            return {"total": 0, "enriched": 0, "errors": 0}

        logger.info("🔍 %d produit(s) à enrichir via Open Food Facts", total)
        if dry_run:
            logger.info("🏁 Mode DRY RUN — aucune écriture en base")

        enriched = 0
        errors = 0
        skipped = 0
        error_details: List[Tuple[int, str, str, str]] = []

        async with httpx.AsyncClient() as client:
            for idx, product in enumerate(products, 1):
                ean = product.ean13

                if not ean or len(ean) < 8:
                    logger.warning("  [%d/%d] ⏭  SKIP  %s (EAN invalide: '%s')", idx, total, product.name, ean)
                    skipped += 1
                    continue

                logger.info(
                    "  [%d/%d] 🔎 %s (EAN: %s)",
                    idx, total, product.name[:50], ean,
                )

                off_data = await _fetch_off(client, ean)
                if off_data is None:
                    logger.warning("  ❌ Produit non trouvé sur OFF: %s", product.name)
                    errors += 1
                    error_details.append((product.id, product.name, ean, "not_found"))
                    await asyncio.sleep(delay)
                    continue

                product_quantity = off_data.get("product_quantity")
                if product_quantity is None:
                    logger.warning("  ❌ Pas de product_quantity pour: %s", product.name)
                    errors += 1
                    error_details.append((product.id, product.name, ean, "no_quantity"))
                    await asyncio.sleep(delay)
                    continue

                product_quantity = int(product_quantity)
                if product_quantity <= 0:
                    logger.warning("  ❌ product_quantity invalide (%d) pour: %s", product_quantity, product.name)
                    errors += 1
                    error_details.append((product.id, product.name, ean, f"invalid_quantity:{product_quantity}"))
                    await asyncio.sleep(delay)
                    continue

                # Détection liquide
                off_name = off_data.get("product_name", "")
                categories = off_data.get("categories", "")
                is_liquid = _is_liquid(off_name, categories)

                if is_liquid:
                    if not dry_run:
                        product.volume_ml = product_quantity
                    log_value = f"📦 volume_ml={product_quantity}"
                else:
                    if not dry_run:
                        product.grammage_g = product_quantity
                    log_value = f"📦 grammage_g={product_quantity}"

                enriched += 1
                logger.info("    ✅ %s — %s", log_value, off_name[:40] if off_name else "")

                if verbose:
                    logger.debug("    Catégories OFF: %s", categories[:120] if categories else "aucune")

                # Rate-limit entre les requêtes
                if idx < total:
                    await asyncio.sleep(delay)

        # Commit des modifications
        if not dry_run and enriched > 0:
            db.commit()
            logger.info("💾 Modifications écrites en base (%d produit(s))", enriched)

        # Résumé avec barre de progression textuelle
        bar_width = 30
        done = enriched + errors + skipped
        filled = int(bar_width * done / total) if total > 0 else bar_width
        bar = "█" * filled + "░" * (bar_width - filled)

        logger.info("")
        logger.info("=" * 50)
        logger.info(" 📊 RÉSULTAT DE L'ENRICHISSEMENT")
        logger.info("=" * 50)
        logger.info(" %s %d/%d", bar, done, total)
        logger.info("   ✅ Enrichis : %d", enriched)
        logger.info("   ❌ Erreurs   : %d", errors)
        logger.info("   ⏭  Ignorés  : %d", skipped)
        if error_details:
            logger.info("")
            logger.info(" Détail des erreurs :")
            for pid, name, ean, reason in error_details:
                logger.info("   - ID=%d %s (EAN: %s) → %s", pid, name[:40], ean, reason)
        logger.info("=" * 50)

        return {
            "total": total,
            "enriched": enriched,
            "errors": errors,
            "skipped": skipped,
        }

    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="Enrichit les grammages/volumes des produits via Open Food Facts.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples :
  python scripts/enrich_ean.py
  python scripts/enrich_ean.py --dry-run
  python scripts/enrich_ean.py --delay 0.5
  python scripts/enrich_ean.py --verbose
        """,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulation sans écriture en base",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Délai entre chaque requête OFF en secondes (défaut: 1.0)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Mode verbose avec logs détaillés",
    )
    args = parser.parse_args()

    if args.verbose:
        logger.setLevel(logging.DEBUG)

    start = time.time()
    result = asyncio.run(enrich_products(
        dry_run=args.dry_run,
        delay=args.delay,
        verbose=args.verbose,
    ))
    elapsed = time.time() - start
    logger.info("⏱  Temps total : %.1f secondes", elapsed)


if __name__ == "__main__":
    main()
