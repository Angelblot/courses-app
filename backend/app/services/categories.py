"""Service de résolution des catégories produits.

Traduit les libellés bruts Carrefour (ex: ``P.L.S.``, ``FRUITS ET LEGUMES``)
vers une taxonomie canonique stable (cf. ``DESIGN.md`` §3.3), utilisée pour
l'UI (chips filtrables + mini-puces sur les cartes produits).

Un lookup disque (``category_aliases``) permet des overrides sans toucher au
code, avec fallback heuristique basé sur des mots-clés. Sans correspondance,
on retombe sur ``autre``.

Le catalogue des catégories canoniques est désormais persisté en base dans la
table ``categories`` (CRUD via l'API). ``CATEGORIES_SEED`` ne sert que de
source d'amorçage sur DB vide.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.category_alias import CategoryAlias


CATEGORIES_SEED: List[Dict[str, object]] = [
    {"key": "fruits_legumes", "label": "Fruits & légumes", "icon": "apple", "display_order": 0},
    {"key": "pls", "label": "Produits laitiers", "icon": "milk", "display_order": 1},
    {"key": "charcuterie", "label": "Charcuterie & traiteur", "icon": "ham", "display_order": 2},
    {"key": "boissons", "label": "Boissons", "icon": "cup-soda", "display_order": 3},
    {"key": "epicerie", "label": "Épicerie", "icon": "package-2", "display_order": 4},
    {"key": "droguerie", "label": "Droguerie", "icon": "spray-can", "display_order": 5},
    {"key": "parfumerie", "label": "Hygiène", "icon": "sparkles", "display_order": 6},
    {"key": "maison", "label": "Maison", "icon": "home", "display_order": 7},
    {"key": "surgeles", "label": "Surgelés", "icon": "snowflake", "display_order": 8},
    {"key": "autre", "label": "Autres", "icon": "tag", "display_order": 99},
]

# Rétro-compat : certains tests / scripts peuvent encore lire ces constantes.
CATEGORIES_CATALOG: List[Dict[str, str]] = [
    {"key": c["key"], "label": c["label"], "icon": c["icon"]} for c in CATEGORIES_SEED
]

SEED_ALIASES: Dict[str, str] = {
    "BOISSONS": "boissons",
    "CHARCUT.TRAITEUR": "charcuterie",
    "CONFORT DE LA MAISON": "maison",
    "DROGUERIE": "droguerie",
    "EPICERIE": "epicerie",
    "FRUITS ET LEGUMES": "fruits_legumes",
    "P.L.S.": "pls",
    "PARFUMERIE HYGIENE": "parfumerie",
    "SURGELES": "surgeles",
    "ARTICLES INDISPONIBLES / NON FACTURÉS": "autre",
}


def _normalize(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    value = raw.strip()
    return value or None


class CategoryService:
    """Résolution des catégories canoniques, avec cache en mémoire."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self._alias_cache: Optional[Dict[str, str]] = None
        self._catalog_cache: Optional[List[Category]] = None

    def _aliases(self) -> Dict[str, str]:
        if self._alias_cache is None:
            rows = self.db.query(CategoryAlias).all()
            self._alias_cache = {r.label_raw: r.key_canonical for r in rows}
        return self._alias_cache

    def _catalog(self) -> List[Category]:
        if self._catalog_cache is None:
            self._catalog_cache = (
                self.db.query(Category)
                .order_by(Category.display_order, Category.label)
                .all()
            )
        return self._catalog_cache

    def _catalog_by_key(self) -> Dict[str, Category]:
        return {c.key: c for c in self._catalog()}

    def _catalog_label_to_key(self) -> Dict[str, str]:
        return {c.label.casefold(): c.key for c in self._catalog()}

    def _invalidate(self) -> None:
        self._catalog_cache = None

    def resolve_key(self, raw_label: Optional[str]) -> str:
        """Retourne la clé canonique (ex: ``pls``) pour un libellé brut."""
        normalized = _normalize(raw_label)
        if normalized is None:
            return "autre"
        aliases = self._aliases()
        if normalized in aliases:
            return aliases[normalized]
        upper = normalized.upper()
        if upper in aliases:
            return aliases[upper]
        canonical = self._catalog_label_to_key().get(normalized.casefold())
        if canonical is not None:
            return canonical
        return "autre"

    def resolve(self, raw_label: Optional[str]) -> Tuple[str, str]:
        """Retourne ``(key, label)`` prêt à sérialiser dans ``ProductOut``."""
        key = self.resolve_key(raw_label)
        by_key = self._catalog_by_key()
        entry = by_key.get(key) or by_key.get("autre")
        if entry is None:
            # DB vide : fallback sur les valeurs par défaut du seed.
            default = next((c for c in CATEGORIES_SEED if c["key"] == key), None)
            if default is None:
                default = next(c for c in CATEGORIES_SEED if c["key"] == "autre")
            return key, str(default["label"])
        return entry.key, entry.label

    def catalog_with_counts(self, raw_labels: List[Optional[str]]) -> List[Dict[str, object]]:
        """Construit la liste ``[{key, label, icon, display_order, count}]`` pour l'API."""
        catalog = self._catalog()
        counts: Dict[str, int] = {c.key: 0 for c in catalog}
        for label in raw_labels:
            key = self.resolve_key(label)
            counts[key] = counts.get(key, 0) + 1
        return [
            {
                "key": c.key,
                "label": c.label,
                "icon": c.icon,
                "display_order": c.display_order,
                "count": counts.get(c.key, 0),
            }
            for c in catalog
        ]

    # --- CRUD -------------------------------------------------------------

    def list_all(self) -> List[Category]:
        return self._catalog()

    def get(self, key: str) -> Optional[Category]:
        return self.db.get(Category, key)

    def create(self, *, key: str, label: str, icon: str, display_order: int = 0) -> Category:
        entry = Category(key=key, label=label, icon=icon, display_order=display_order)
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        self._invalidate()
        return entry

    def update(
        self,
        key: str,
        *,
        label: Optional[str] = None,
        icon: Optional[str] = None,
        display_order: Optional[int] = None,
    ) -> Optional[Category]:
        entry = self.get(key)
        if entry is None:
            return None
        if label is not None:
            entry.label = label
        if icon is not None:
            entry.icon = icon
        if display_order is not None:
            entry.display_order = display_order
        self.db.commit()
        self.db.refresh(entry)
        self._invalidate()
        return entry

    def delete(self, key: str) -> bool:
        entry = self.get(key)
        if entry is None:
            return False
        self.db.delete(entry)
        self.db.commit()
        self._invalidate()
        return True

    def count_products_for_key(self, key: str) -> int:
        """Nombre de produits rattachés à cette catégorie canonique."""
        from app.models.product import Product

        rows = self.db.query(Product.category).all()
        return sum(1 for (raw,) in rows if self.resolve_key(raw) == key)


def seed_category_aliases(db: Session) -> int:
    """Insère les alias canoniques manquants. Idempotent.

    Returns:
        Nombre de nouveaux alias insérés.
    """
    existing = {row.label_raw for row in db.query(CategoryAlias).all()}
    inserted = 0
    for raw, key in SEED_ALIASES.items():
        if raw in existing:
            continue
        db.add(CategoryAlias(label_raw=raw, key_canonical=key))
        inserted += 1
    if inserted:
        db.commit()
    return inserted


def seed_categories(db: Session) -> int:
    """Insère les catégories canoniques manquantes. Idempotent.

    Returns:
        Nombre de catégories insérées.
    """
    existing = {row.key for row in db.query(Category).all()}
    inserted = 0
    for entry in CATEGORIES_SEED:
        if entry["key"] in existing:
            continue
        db.add(
            Category(
                key=str(entry["key"]),
                label=str(entry["label"]),
                icon=str(entry["icon"]),
                display_order=int(entry["display_order"]),
            )
        )
        inserted += 1
    if inserted:
        db.commit()
    return inserted
