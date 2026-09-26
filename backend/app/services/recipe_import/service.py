"""Orchestration de l'import de recettes (lien ou photo) vers un brouillon éditable."""
from __future__ import annotations

import base64
import unicodedata
from typing import Iterable, List, Optional
from urllib.parse import urlparse

from app.schemas.recipe import RecipeDraft, RecipeIngredientCreate
from app.services.recipe_import import llm
from app.services.recipe_import.ingredient_parser import parse_ingredient_line
from app.services.recipe_import.web import (
    RecipeImportError,
    ensure_public_url,
    extract_jsonld_recipe,
    extract_visible_text,
    fetch_page,
    servings_hint_from_url,
)

SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024

_CATEGORY_KEYWORDS = (
    ("Entrées", ("entree", "starter", "salade")),
    ("Desserts", ("dessert", "gateau", "patisserie", "sucre")),
    ("Petit-déjeuner", ("petit-dejeuner", "petit dejeuner", "brunch", "breakfast")),
    ("Goûter", ("gouter",)),
    ("Apéritif", ("aperitif", "apero", "amuse")),
    ("Plats", ("plat", "main", "diner", "dejeuner")),
)


def _plain(value: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", value.lower()) if unicodedata.category(c) != "Mn"
    )


def map_category(raw: Optional[str]) -> Optional[str]:
    """Rapproche une catégorie de site des catégories de l'app.

    Args:
        raw: Catégorie publiée (« Entrée », « Plat principal »…).

    Returns:
        Une catégorie de l'app ou ``None``.
    """
    if not raw:
        return None
    plain = _plain(raw)
    for category, keywords in _CATEGORY_KEYWORDS:
        if any(kw in plain for kw in keywords):
            return category
    return None


def _per_serving(total: float, servings: int) -> float:
    return round(total / max(servings, 1), 3)


def _from_llm_ingredients(items: Iterable[llm.LlmIngredient], servings: int) -> List[RecipeIngredientCreate]:
    return [
        RecipeIngredientCreate(
            name=item.name.strip()[:255],
            quantity_per_serving=_per_serving(max(item.quantity, 0.0), servings),
            unit=item.unit,
            rayon=item.rayon,
            category="Placard" if item.pantry else None,
        )
        for item in items
        if item.name.strip()
    ]


def _from_raw_lines(lines: Iterable[str], servings: int) -> List[RecipeIngredientCreate]:
    result = []
    for line in lines:
        parsed = parse_ingredient_line(line)
        if parsed is None:
            continue
        result.append(
            RecipeIngredientCreate(
                name=parsed.name,
                quantity_per_serving=_per_serving(parsed.quantity, servings),
                unit=parsed.unit,
                rayon=parsed.rayon,
            )
        )
    return result


def _site_label(url: str) -> str:
    host = urlparse(url).hostname or url
    return host[4:] if host.startswith("www.") else host


def import_from_url(url: str) -> RecipeDraft:
    """Construit un brouillon de recette à partir d'un lien.

    Stratégie : JSON-LD schema.org (fiable, gratuit) puis normalisation des
    ingrédients par Claude si disponible ; sinon parsing déterministe. Si la
    page n'a pas de JSON-LD, analyse du texte de la page par Claude.

    Args:
        url: Lien saisi ou partagé par l'utilisateur.

    Returns:
        Le brouillon, non enregistré.

    Raises:
        RecipeImportError: Si aucune recette exploitable n'est trouvée.
    """
    safe_url = ensure_public_url(url)
    page_html = fetch_page(safe_url)
    warnings: List[str] = []
    hint = servings_hint_from_url(safe_url)

    structured = extract_jsonld_recipe(page_html)
    if structured is not None:
        servings = structured.servings or hint or 4
        if not structured.servings:
            warnings.append("Nombre de personnes non indiqué par le site : vérifie-le.")
        category = map_category(structured.category)
        ingredients: List[RecipeIngredientCreate] = []
        if llm.is_available():
            try:
                normalized = llm.normalize_ingredients(structured.name, servings, structured.ingredients)
                ingredients = _from_llm_ingredients(normalized.ingredients, servings)
                category = category or normalized.category
            except RecipeImportError:
                ingredients = []
        if not ingredients:
            ingredients = _from_raw_lines(structured.ingredients, servings)
            warnings.append("Quantités lues automatiquement : jette un œil avant d'enregistrer.")
        return RecipeDraft(
            name=structured.name[:255],
            description=structured.description,
            servings_default=hint or servings,
            category=category,
            image_url=(structured.image_url or "")[:500] or None,
            ingredients=ingredients,
            source="url",
            source_url=safe_url,
            warnings=warnings,
        )

    if not llm.is_available():
        raise RecipeImportError(
            f"{_site_label(safe_url)} ne publie pas sa recette dans un format lisible automatiquement."
        )
    result = llm.recipe_from_page_text(extract_visible_text(page_html), safe_url)
    servings = max(result.servings, 1)
    return RecipeDraft(
        name=result.name[:255],
        description=result.description,
        servings_default=hint or servings,
        category=result.category,
        ingredients=_from_llm_ingredients(result.ingredients, servings),
        source="url",
        source_url=safe_url,
        warnings=["Recette lue par IA depuis la page : vérifie les quantités."],
    )


def import_from_photo(data: bytes, media_type: str) -> RecipeDraft:
    """Construit un brouillon de recette à partir de la photo d'une fiche.

    Args:
        data: Contenu binaire de l'image.
        media_type: Type MIME de l'image.

    Returns:
        Le brouillon, non enregistré.

    Raises:
        RecipeImportError: Image invalide ou recette illisible.
    """
    if media_type not in SUPPORTED_IMAGE_TYPES:
        raise RecipeImportError("Format d'image non pris en charge (JPEG, PNG ou WebP).")
    if not data:
        raise RecipeImportError("La photo est vide.")
    if len(data) > MAX_IMAGE_BYTES:
        raise RecipeImportError("La photo est trop lourde (10 Mo maximum).")

    result = llm.recipe_from_image(base64.standard_b64encode(data).decode("ascii"), media_type)
    servings = max(result.servings, 1)
    return RecipeDraft(
        name=result.name[:255],
        description=result.description,
        servings_default=servings,
        category=result.category,
        ingredients=_from_llm_ingredients(result.ingredients, servings),
        source="photo",
        warnings=["Recette lue sur la photo : vérifie les quantités avant d'enregistrer."],
    )
