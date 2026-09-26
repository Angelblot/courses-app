"""Structuration de recettes par Claude (photo de fiche, texte de page, ingrédients).

Toutes les fonctions renvoient un :class:`LlmRecipe` validé via les structured
outputs de l'API (``messages.parse``) : pas de parsing JSON fragile.
"""
from __future__ import annotations

import os
from typing import List, Literal, Optional

import anthropic
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.services.recipe_import.ingredient_parser import RAYONS
from app.services.recipe_import.web import RecipeImportError

Unit = Literal[
    "g", "ml", "unité", "pincée", "cuillère à soupe", "cuillère à café",
    "gousse", "tranche", "sachet", "botte", "paquet", "boîte", "branche",
]
Rayon = Literal[RAYONS]  # type: ignore[valid-type]
RecipeCategory = Literal["Entrées", "Plats", "Desserts", "Petit-déjeuner", "Goûter", "Apéritif"]


class LlmIngredient(BaseModel):
    """Ingrédient structuré renvoyé par le modèle."""

    name: str = Field(description="Nom générique de l'ingrédient, tel qu'on le chercherait en drive.")
    quantity: float = Field(description="Quantité TOTALE pour la recette entière (pas par personne).")
    unit: Unit
    rayon: Rayon
    pantry: bool = Field(description="True pour un basique du placard (sel, poivre, huile, sucre, vinaigre).")


class LlmRecipe(BaseModel):
    """Recette structurée renvoyée par le modèle."""

    is_recipe: bool = Field(description="False si le contenu ne contient pas de recette lisible.")
    name: str
    servings: int = Field(description="Nombre de personnes pour lesquelles les quantités sont données.")
    category: Optional[RecipeCategory] = None
    description: Optional[str] = Field(None, description="Une phrase d'accroche courte, en français.")
    ingredients: List[LlmIngredient]


_SYSTEM = f"""Tu extrais des recettes de cuisine pour une application française de liste de courses.
L'objectif est de générer automatiquement un panier drive : chaque ingrédient doit être
un produit achetable, avec une quantité exploitable.

Règles :
- Un ingrédient par produit à acheter. Sépare les lignes composées (« moutarde et gruyère râpé (125 g) » -> deux ingrédients).
- Nom court et générique en français, sans la préparation (« Oignon », pas « oignon émincé en demi-lunes »).
- Quantités TOTALES pour la recette, dans l'unité la plus naturelle parmi celles autorisées.
  Convertis : kg -> g, cl/L -> ml, « cs » -> cuillère à soupe, « cc » -> cuillère à café, « pièce(s) »/« pot »/« paquet » d'un seul produit -> unité ou l'unité dédiée.
- Fractions en décimal (½ -> 0.5). « Selon votre goût » -> 1 pincée.
- Inclus les ingrédients « à ajouter vous-même » / « du placard » (sel, poivre, huile…) avec pantry=true.
- N'invente rien : si une quantité est absente, mets 1 et l'unité « unité ».
- Rayons autorisés : {", ".join(RAYONS)}.
"""


def _api_key() -> Optional[str]:
    return get_settings().anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY")


def is_available() -> bool:
    """Indique si une clé API Claude est configurée."""
    return bool(_api_key())


def _client() -> anthropic.Anthropic:
    key = _api_key()
    if not key:
        raise RecipeImportError(
            "L'analyse par IA n'est pas configurée sur le serveur (clé ANTHROPIC_API_KEY manquante)."
        )
    return anthropic.Anthropic(api_key=key, timeout=90.0, max_retries=2)


def _run(content: list, effort: str) -> LlmRecipe:
    settings = get_settings()
    try:
        response = _client().messages.parse(
            model=settings.anthropic_model,
            max_tokens=16000,
            system=_SYSTEM,
            output_config={"effort": effort},
            messages=[{"role": "user", "content": content}],
            output_format=LlmRecipe,
        )
    except anthropic.RateLimitError as exc:
        raise RecipeImportError("Le service d'analyse est saturé, réessaie dans une minute.") from exc
    except anthropic.APIConnectionError as exc:
        raise RecipeImportError("Impossible de joindre le service d'analyse, réessaie.") from exc
    except anthropic.APIStatusError as exc:
        raise RecipeImportError(
            f"Le service d'analyse a renvoyé une erreur ({exc.status_code})."
        ) from exc

    if response.stop_reason == "refusal":
        raise RecipeImportError("Ce contenu n'a pas pu être analysé.")
    if response.stop_reason == "max_tokens" or response.parsed_output is None:
        raise RecipeImportError("La recette est trop longue pour être analysée d'un coup.")
    result = response.parsed_output
    if not result.is_recipe or not result.ingredients:
        raise RecipeImportError("Aucune recette lisible n'a été trouvée.")
    return result


def recipe_from_image(image_b64: str, media_type: str) -> LlmRecipe:
    """Extrait une recette depuis la photo d'une fiche (HelloFresh, livre, carnet…).

    Args:
        image_b64: Image encodée en base64 (sans préfixe ``data:``).
        media_type: ``image/jpeg``, ``image/png``, ``image/webp`` ou ``image/gif``.

    Returns:
        La recette structurée.
    """
    return _run(
        [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
            {
                "type": "text",
                "text": (
                    "Voici la photo d'une fiche recette. Extrais le titre, le nombre de personnes "
                    "(« Ingrédients pour N personnes ») et TOUS les ingrédients, y compris ceux à "
                    "ajouter soi-même. Ignore les étapes, valeurs nutritionnelles et allergènes."
                ),
            },
        ],
        effort="medium",
    )


def recipe_from_page_text(page_text: str, url: str) -> LlmRecipe:
    """Extrait une recette depuis le texte brut d'une page web sans données structurées.

    Args:
        page_text: Texte visible de la page.
        url: URL d'origine (contexte).

    Returns:
        La recette structurée.
    """
    return _run(
        [{"type": "text", "text": f"Page : {url}\n\n<page>\n{page_text}\n</page>\n\nExtrais la recette."}],
        effort="low",
    )


def normalize_ingredients(name: str, servings: int, lines: List[str]) -> LlmRecipe:
    """Normalise des lignes d'ingrédients brutes (issues du JSON-LD d'un site).

    Args:
        name: Titre de la recette.
        servings: Nombre de personnes annoncé par le site.
        lines: Lignes d'ingrédients telles que publiées.

    Returns:
        La recette structurée (seuls ``ingredients`` et ``category`` sont exploités).
    """
    listing = "\n".join(f"- {line}" for line in lines)
    return _run(
        [
            {
                "type": "text",
                "text": (
                    f"Recette : {name}\nPour {servings} personne(s).\n"
                    f"Ingrédients bruts :\n{listing}\n\nStructure ces ingrédients."
                ),
            }
        ],
        effort="low",
    )
