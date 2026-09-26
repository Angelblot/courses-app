"""Parsing déterministe des lignes d'ingrédients en français.

Transforme une ligne libre (« 200 g Patate douce », « 1/4 gou. Ail »,
« 2 cuillères à soupe d'huile d'olive ») en triplet quantité / unité / nom,
avec des unités alignées sur celles comprises par le frontend
(``frontend/src/lib/unitConverter.js``).
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Optional, Tuple

# Rayons proposés dans le formulaire recette (frontend RecipeForm.jsx).
RAYONS = (
    "Fruits & légumes",
    "Boucherie",
    "Poissonnerie",
    "Crèmerie",
    "Boulangerie",
    "Épicerie",
    "Surgelés",
    "Boissons",
    "Hygiène",
    "Entretien",
    "Divers",
)

# Alias d'unité (clé normalisée sans accents ni point final) -> (unité canonique, facteur).
_UNIT_ALIASES = {
    "g": ("g", 1.0), "gr": ("g", 1.0), "gramme": ("g", 1.0), "grammes": ("g", 1.0),
    "kg": ("g", 1000.0), "kilo": ("g", 1000.0), "kilos": ("g", 1000.0),
    "kilogramme": ("g", 1000.0), "kilogrammes": ("g", 1000.0),
    "mg": ("g", 0.001),
    "ml": ("ml", 1.0), "millilitre": ("ml", 1.0), "millilitres": ("ml", 1.0),
    "cl": ("ml", 10.0), "centilitre": ("ml", 10.0), "centilitres": ("ml", 10.0),
    "dl": ("ml", 100.0), "decilitre": ("ml", 100.0), "decilitres": ("ml", 100.0),
    "l": ("ml", 1000.0), "litre": ("ml", 1000.0), "litres": ("ml", 1000.0),
    "cs": ("cuillère à soupe", 1.0), "c.s": ("cuillère à soupe", 1.0),
    "cas": ("cuillère à soupe", 1.0), "c.a.s": ("cuillère à soupe", 1.0),
    "cuil. a soupe": ("cuillère à soupe", 1.0), "c. a soupe": ("cuillère à soupe", 1.0),
    "cuillere a soupe": ("cuillère à soupe", 1.0), "cuilleres a soupe": ("cuillère à soupe", 1.0),
    "cc": ("cuillère à café", 1.0), "c.c": ("cuillère à café", 1.0),
    "cac": ("cuillère à café", 1.0), "c.a.c": ("cuillère à café", 1.0),
    "cuil. a cafe": ("cuillère à café", 1.0), "c. a cafe": ("cuillère à café", 1.0),
    "cuillere a cafe": ("cuillère à café", 1.0), "cuilleres a cafe": ("cuillère à café", 1.0),
    "pincee": ("pincée", 1.0), "pincees": ("pincée", 1.0), "pinc": ("pincée", 1.0),
    "gousse": ("gousse", 1.0), "gousses": ("gousse", 1.0), "gou": ("gousse", 1.0),
    "tranche": ("tranche", 1.0), "tranches": ("tranche", 1.0), "tr": ("tranche", 1.0),
    "sachet": ("sachet", 1.0), "sachets": ("sachet", 1.0),
    "botte": ("botte", 1.0), "bottes": ("botte", 1.0), "bou": ("botte", 1.0),
    "paquet": ("paquet", 1.0), "paquets": ("paquet", 1.0),
    "boite": ("boîte", 1.0), "boites": ("boîte", 1.0),
    "branche": ("branche", 1.0), "branches": ("branche", 1.0),
    "brin": ("branche", 1.0), "brins": ("branche", 1.0),
    "piece": ("unité", 1.0), "pieces": ("unité", 1.0),
    "unite": ("unité", 1.0), "unites": ("unité", 1.0),
    "pot": ("unité", 1.0), "pots": ("unité", 1.0),
    "feuille": ("unité", 1.0), "feuilles": ("unité", 1.0),
}

# Alias multi-mots testés en priorité (le plus long d'abord).
_MULTIWORD_UNITS = sorted(
    (k for k in _UNIT_ALIASES if " " in k), key=len, reverse=True
)

_FRACTIONS = {"½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125}

_NUMBER_RE = re.compile(
    r"^\s*(?P<num>\d+\s*/\s*\d+|\d+(?:[.,]\d+)?(?:\s*[½¼¾⅓⅔⅛])?|[½¼¾⅓⅔⅛])"
)

# Mots-clés -> rayon, pour le fallback sans LLM.
_RAYON_KEYWORDS = (
    ("Boucherie", ("jambon", "lardon", "chorizo", "saucisse", "poulet", "dinde", "boeuf", "bœuf", "veau", "porc", "agneau", "canard", "steak", "viande", "hache", "haché")),
    ("Poissonnerie", ("saumon", "cabillaud", "thon frais", "crevette", "poisson", "moule", "colin", "lieu")),
    ("Crèmerie", ("lait", "beurre", "creme", "crème", "yaourt", "fromage", "feta", "gruyere", "gruyère", "mozzarella", "parmesan", "emmental", "oeuf", "œuf", "comte", "comté", "chevre", "chèvre")),
    ("Boulangerie", ("pain", "baguette", "brioche")),
    ("Surgelés", ("surgele", "surgelé")),
    ("Boissons", ("vin blanc", "vin rouge", "biere", "bière", "jus")),
    ("Fruits & légumes", (
        "oignon", "echalote", "échalote", "ail", "pomme de terre", "pommes de terre", "patate", "carotte",
        "courgette", "tomate", "poivron", "aubergine", "salade", "sucrine", "laitue", "avocat",
        "citron", "orange", "pomme", "poire", "banane", "coriandre", "persil", "basilic", "ciboulette",
        "menthe", "champignon", "poireau", "epinard", "épinard", "brocoli", "chou", "concombre", "radis",
        "gingembre", "piment frais", "haricot vert", "fenouil", "celeri", "céleri", "potiron", "courge",
    )),
)


@dataclass
class ParsedIngredient:
    """Ingrédient structuré issu d'une ligne libre."""

    name: str
    quantity: float
    unit: str
    rayon: str


def _strip_accents(value: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", value) if unicodedata.category(c) != "Mn"
    )


def _normalize_unit_token(token: str) -> str:
    return _strip_accents(token.lower()).rstrip(".").strip()


def normalize_unit(raw: Optional[str]) -> Tuple[str, float]:
    """Normalise une unité libre en unité canonique.

    Args:
        raw: Unité telle qu'écrite dans la source (« cl », « c. à s. », « gou. »…).

    Returns:
        Tuple ``(unité canonique, facteur multiplicatif)``. ``("unité", 1.0)``
        si l'unité est absente ou inconnue.
    """
    if not raw:
        return "unité", 1.0
    key = _normalize_unit_token(raw)
    key = re.sub(r"\s+", " ", key)
    if key in _UNIT_ALIASES:
        return _UNIT_ALIASES[key]
    compact = key.replace(" ", "").replace(".", "")
    for alias, value in _UNIT_ALIASES.items():
        if alias.replace(" ", "").replace(".", "") == compact:
            return value
    return "unité", 1.0


def _parse_number(raw: str) -> float:
    raw = raw.strip()
    if "/" in raw:
        num, den = (p.strip() for p in raw.split("/", 1))
        return float(num) / float(den) if float(den) else 0.0
    total = 0.0
    for sym, val in _FRACTIONS.items():
        if sym in raw:
            total += val
            raw = raw.replace(sym, "")
    raw = raw.strip().replace(",", ".")
    if raw:
        total += float(raw)
    return total


def guess_rayon(name: str) -> str:
    """Devine le rayon d'un ingrédient à partir de mots-clés.

    Args:
        name: Nom de l'ingrédient.

    Returns:
        Un rayon de ``RAYONS`` (``"Épicerie"`` par défaut).
    """
    low = f" {name.lower()} "
    plain = f" {_strip_accents(name.lower())} "
    for rayon, keywords in _RAYON_KEYWORDS:
        for kw in keywords:
            if re.search(rf"\b{re.escape(kw)}", low) or re.search(
                rf"\b{re.escape(_strip_accents(kw))}", plain
            ):
                return rayon
    return "Épicerie"


def _clean_name(name: str) -> str:
    name = re.sub(r"^\s*(?:de la |de l'|de l’|du |des |de |d'|d’)", "", name, flags=re.I)
    name = re.sub(r"\s+", " ", name).strip(" ,.;:-")
    return name[:1].upper() + name[1:] if name else name


def parse_ingredient_line(line: str) -> Optional[ParsedIngredient]:
    """Parse une ligne d'ingrédient libre.

    Args:
        line: Ligne telle que publiée (« 200 g Patate douce »).

    Returns:
        ``ParsedIngredient`` ou ``None`` si la ligne est vide.
    """
    text = re.sub(r"\s+", " ", (line or "").replace("\xa0", " ")).strip()
    if not text:
        return None

    quantity = 1.0
    unit = "unité"
    rest = text

    match = _NUMBER_RE.match(text)
    if match:
        try:
            quantity = _parse_number(match.group("num"))
        except (ValueError, ZeroDivisionError):
            quantity = 1.0
        rest = text[match.end():].strip()

        # « 125g » collé ou « 200 g » séparé.
        lowered = _strip_accents(rest.lower())
        matched_unit = False
        for alias in _MULTIWORD_UNITS:
            if lowered.startswith(alias):
                unit, factor = _UNIT_ALIASES[alias]
                quantity *= factor
                rest = rest[len(alias):]
                matched_unit = True
                break
        if not matched_unit:
            token_match = re.match(r"^([A-Za-zÀ-ÿ.]+)(?=\s|$|\b)", rest)
            if token_match:
                token = token_match.group(1)
                key = _normalize_unit_token(token)
                if key in _UNIT_ALIASES:
                    unit, factor = _UNIT_ALIASES[key]
                    quantity *= factor
                    rest = rest[token_match.end():]
        rest = rest.strip()

    name = _clean_name(rest) or _clean_name(text)
    return ParsedIngredient(
        name=name[:255],
        quantity=round(quantity, 3),
        unit=unit,
        rayon=guess_rayon(name),
    )
