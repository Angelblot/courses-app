"""Service d'enrichissement des grammages/volumes via l'API Open Food Facts.

Interroge l'API publique d'Open Food Facts pour chaque produit possédant
un code-barres (EAN13) mais sans grammage ni volume renseigné, et met à
jour la base de données avec les valeurs récupérées.
"""

import asyncio
import logging
import re
from typing import Dict, List, Optional, Tuple

import httpx
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.product import Product

logger = logging.getLogger(__name__)

# Rate-limit : 1 requête par seconde maximum (recommandation OFF : 20 req/min)
RATE_LIMIT_DELAY = 1.0

# URL de base de l'API Open Food Facts
OFF_API_URL = "https://fr.openfoodfacts.org/api/v2/product/{ean}.json"

# Catégories / patterns qui indiquent un produit liquide → volume_ml
LIQUID_PATTERNS: List[str] = [
    r"(?i)\blait\b",
    r"(?i)\bhuile\b",
    r"(?i)\bcr[eé]me\b",
    r"(?i)\bjus\b",
    r"(?i)\bsoda\b",
    r"(?i)\bbi[eè]re\b",
    r"(?i)\bvin\b",
    r"(?i)\bsauce\b",
    r"(?i)\bsirop\b",
    r"(?i)\bboisson\b",
    r"(?i)\blimonade\b",
    r"(?i)\blait\b",
    r"(?i)\byaourt\b",
    r"(?i)\byogourt\b",
    r"(?i)\bfromage\s+frais\b",
    r"(?i)\bl[\s-]*?\bfrais\b",
    r"(?i)\bsoda\b",
    r"(?i)\btonic\b",
    r"(?i)\benergy\s+drink\b",
    r"(?i)\beau\b",
    r"(?i)\b[nN]ectar\b",
    r"(?i)\bsmoothie\b",
]

# Unités qui indiquent clairement un liquide en ml
LIQUID_UNITS = {"l", "ml", "cl", "dl", "litre", "litres"}


def _is_likely_liquid(name: str, category: Optional[str] = None) -> bool:
    """Détermine si un produit est probablement liquide.

    Vérifie le nom du produit ET la catégorie (quand disponible) contre une
    liste de patterns.

    Args:
        name: Nom du produit.
        category: Catégorie optionnelle du produit.

    Returns:
        True si le produit semble être un liquide.
    """
    text = name
    if category:
        text += " " + category
    for pat in LIQUID_PATTERNS:
        if re.search(pat, text):
            return True
    return False


def _infer_grammage(product_quantity: int, unit: str) -> Tuple[Optional[int], Optional[int]]:
    """Convertit product_quantity en grammage_g et volume_ml.

    Args:
        product_quantity: Quantité renvoyée par Open Food Facts (en g ou ml).
        unit: Unité du produit dans notre base (ex: 'unité', 'g', 'ml').

    Returns:
        Tuple (grammage_g, volume_ml). L'un des deux sera None.
    """
    if unit in LIQUID_UNITS:
        return None, product_quantity
    # Par défaut, on considère product_quantity comme des grammes (solide)
    return product_quantity, None


async def _fetch_product_data(client: httpx.AsyncClient, ean: str) -> Optional[Dict]:
    """Interroge l'API Open Food Facts pour un EAN donné.

    Gère les rate-limits (HTTP 429) avec retry automatique et backoff.

    Args:
        client: Client HTTP asynchrone.
        ean: Code-barres EAN13.

    Returns:
        Dictionnaire du produit (clé 'product'), ou None si erreur / non trouvé.
    """
    url = OFF_API_URL.format(ean=ean)
    max_retries = 3
    for attempt in range(max_retries):
        try:
            resp = await client.get(url, timeout=10.0)
            if resp.status_code == 429:
                retry_after = _parse_retry_after(resp) or (2 ** attempt)
                logger.warning("Rate-limited (429) for EAN %s, retrying in %ds (attempt %d/%d)", ean, retry_after, attempt + 1, max_retries)
                await asyncio.sleep(retry_after)
                continue
            if resp.status_code != 200:
                logger.debug("OFF returned %d for EAN %s", resp.status_code, ean)
                return None
            data = resp.json()
            if data.get("status") != 1:
                logger.debug("OFF status != 1 for EAN %s (product not found)", ean)
                return None
            return data.get("product")
        except httpx.TimeoutException:
            if attempt < max_retries - 1:
                wait = 2 ** attempt
                logger.warning("Timeout fetching EAN %s, retrying in %ds (attempt %d/%d)", ean, wait, attempt + 1, max_retries)
                await asyncio.sleep(wait)
                continue
            logger.warning("Timeout fetching EAN %s after %d attempts", ean, max_retries)
            return None
        except Exception as exc:
            logger.warning("Error fetching EAN %s: %s", ean, type(exc).__name__)
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


async def enrich_one_product(
    client: httpx.AsyncClient, product: Product
) -> Tuple[int, bool, Optional[str]]:
    """Enrichit un seul produit via Open Food Facts.

    Args:
        client: Client HTTP asynchrone.
        product: Instance Product à enrichir.

    Returns:
        Tuple (product_id, success, error_message).
    """
    if not product.ean13:
        return (product.id, False, "no EAN")

    data = await _fetch_product_data(client, product.ean13)
    if data is None:
        return (product.id, False, "OFF product not found")

    product_quantity = data.get("product_quantity")
    if product_quantity is None:
        return (product.id, False, "no product_quantity in OFF")

    product_quantity = int(product_quantity)
    if product_quantity <= 0:
        return (product.id, False, f"invalid product_quantity={product_quantity}")

    # Détection liquide
    product_name = data.get("product_name", "")
    categories = data.get("categories", "")
    is_liquid = _is_likely_liquid(product_name, categories)

    if is_liquid:
        product.volume_ml = product_quantity
        product.grammage_g = None
    else:
        product.grammage_g = product_quantity
        product.volume_ml = None

    return (product.id, True, None)


async def enrich_all_products(
    db_session_factory=SessionLocal,
    rate_limit_delay: float = RATE_LIMIT_DELAY,
) -> Dict:
    """Enrichit tous les produits sans grammage via Open Food Facts.

    Parcourt les produits qui ont un EAN13 mais ni grammage_g ni volume_ml
    renseignés, interroge OFF pour chaque, et met à jour la base de données.

    Args:
        db_session_factory: Factory pour créer une session DB.
        rate_limit_delay: Délai entre chaque requête OFF (secondes).

    Returns:
        Dictionnaire récapitulatif : {total, enriched, errors, details}.
    """
    db = db_session_factory()
    try:
        stmt = select(Product).where(
            Product.ean13.is_not(None),
            Product.grammage_g.is_(None),
            Product.volume_ml.is_(None),
        )
        products = list(db.execute(stmt).scalars().all())

        total = len(products)
        enriched = 0
        errors: List[Dict] = []
        details: List[Dict] = []

        if total == 0:
            return {"total": 0, "enriched": 0, "errors": 0, "details": []}

        async with httpx.AsyncClient() as client:
            for i, product in enumerate(products):
                pid, success, error_msg = await enrich_one_product(client, product)
                if success:
                    enriched += 1
                    details.append({
                        "id": pid,
                        "name": product.name,
                        "ean13": product.ean13,
                        "grammage_g": product.grammage_g,
                        "volume_ml": product.volume_ml,
                    })
                else:
                    errors.append({
                        "id": pid,
                        "name": product.name,
                        "ean13": product.ean13,
                        "error": error_msg,
                    })

                # Rate-limit : attendre entre chaque requête
                if i < total - 1:
                    await asyncio.sleep(rate_limit_delay)

        db.commit()

        return {
            "total": total,
            "enriched": enriched,
            "errors": len(errors),
            "details": details,
            "error_list": errors,
        }
    finally:
        db.close()


async def enrich_product_by_id(
    product_id: int,
    db_session_factory=SessionLocal,
) -> Dict:
    """Enrichit un seul produit (par son ID) via Open Food Facts.

    Args:
        product_id: ID du produit.
        db_session_factory: Factory pour créer une session DB.

    Returns:
        Dictionnaire avec le résultat.
    """
    db = db_session_factory()
    try:
        product = db.get(Product, product_id)
        if product is None:
            return {"success": False, "error": "Product not found"}

        async with httpx.AsyncClient() as client:
            pid, success, error_msg = await enrich_one_product(client, product)

        if success:
            db.commit()
            return {
                "success": True,
                "id": pid,
                "name": product.name,
                "ean13": product.ean13,
                "grammage_g": product.grammage_g,
                "volume_ml": product.volume_ml,
            }
        else:
            return {"success": False, "id": pid, "name": product.name, "error": error_msg}
    finally:
        db.close()
