"""Service de résolution des catégories produits.

Traduit les libellés bruts Carrefour (ex: ``P.L.S.``, ``FRUITS ET LEGUMES``)
vers une taxonomie canonique stable (cf. ``DESIGN.md`` §3.3), utilisée pour
l'UI (chips filtrables + mini-puces sur les cartes produits).

Un lookup disque (``category_aliases``) permet des overrides sans toucher au
code, avec fallback heuristique basé sur des mots-clés. Sans correspondance,
on retombe sur ``autre``.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.category_alias import CategoryAlias


CATEGORIES_CATALOG: List[Dict[str, str]] = [
    {"key": "fruits_legumes", "label": "Fruits & légumes", "icon": "apple"},
    {"key": "pls", "label": "Produits laitiers", "icon": "milk"},
    {"key": "charcuterie", "label": "Charcuterie & traiteur", "icon": "ham"},
    {"key": "boissons", "label": "Boissons", "icon": "cup-soda"},
    {"key": "epicerie", "label": "Épicerie", "icon": "package-2"},
    {"key": "droguerie", "label": "Droguerie", "icon": "spray-can"},
    {"key": "parfumerie", "label": "Hygiène", "icon": "sparkles"},
    {"key": "maison", "label": "Maison", "icon": "home"},
    {"key": "surgeles", "label": "Surgelés", "icon": "snowflake"},
    {"key": "autre", "label": "Autres", "icon": "tag"},
]

CATALOG_BY_KEY: Dict[str, Dict[str, str]] = {c["key"]: c for c in CATEGORIES_CATALOG}
CATALOG_ORDER: Dict[str, int] = {c["key"]: idx for idx, c in enumerate(CATEGORIES_CATALOG)}

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
    """Résolution des catégories canoniques, avec cache en mémoire des alias."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self._alias_cache: Optional[Dict[str, str]] = None

    def _aliases(self) -> Dict[str, str]:
        if self._alias_cache is None:
            rows = self.db.query(CategoryAlias).all()
            self._alias_cache = {r.label_raw: r.key_canonical for r in rows}
        return self._alias_cache

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
        return "autre"

    def resolve(self, raw_label: Optional[str]) -> Tuple[str, str]:
        """Retourne ``(key, label)`` prêt à sérialiser dans ``ProductOut``."""
        key = self.resolve_key(raw_label)
        entry = CATALOG_BY_KEY.get(key, CATALOG_BY_KEY["autre"])
        return key, entry["label"]

    def catalog_with_counts(self, raw_labels: List[Optional[str]]) -> List[Dict[str, object]]:
        """Construit la liste ``[{key, label, icon, count}]`` pour l'API.

        Args:
            raw_labels: libellés bruts de chaque produit du périmètre (avec
                doublons). La longueur égale le nombre de produits.
        """
        counts: Dict[str, int] = {c["key"]: 0 for c in CATEGORIES_CATALOG}
        for label in raw_labels:
            counts[self.resolve_key(label)] += 1
        return [
            {
                "key": c["key"],
                "label": c["label"],
                "icon": c["icon"],
                "count": counts[c["key"]],
            }
            for c in CATEGORIES_CATALOG
        ]


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
