"""Récupération d'une page de recette et extraction des données schema.org.

La très grande majorité des sites de recettes (Marmiton, Jow, 750g, CuisineAZ,
HelloFresh, blogs WordPress…) publient un bloc JSON-LD ``@type: Recipe`` pour
le SEO : c'est la source la plus fiable, on la lit en priorité.
"""
from __future__ import annotations

import html as html_lib
import ipaddress
import json
import re
import socket
from dataclasses import dataclass, field
from typing import Any, Iterable, List, Optional
from urllib.parse import parse_qs, urlparse

import httpx

MAX_PAGE_BYTES = 5_000_000
FETCH_TIMEOUT_S = 15.0
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

_LD_JSON_RE = re.compile(
    r"<script[^>]*type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
    re.S | re.I,
)


class RecipeImportError(Exception):
    """Erreur d'import présentable telle quelle à l'utilisateur."""


@dataclass
class JsonLdRecipe:
    """Sous-ensemble utile d'un objet schema.org ``Recipe``."""

    name: str
    ingredients: List[str]
    servings: Optional[int] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    keywords: List[str] = field(default_factory=list)


def ensure_public_url(url: str) -> str:
    """Valide une URL fournie par l'utilisateur avant de la récupérer.

    Refuse les schémas non HTTP et les hôtes résolus vers une IP privée,
    loopback ou link-local (protection SSRF).

    Args:
        url: URL saisie par l'utilisateur.

    Returns:
        L'URL nettoyée.

    Raises:
        RecipeImportError: Si l'URL est invalide ou non publique.
    """
    url = (url or "").strip()
    if url and not re.match(r"^https?://", url, re.I):
        url = f"https://{url}"
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise RecipeImportError("Ce lien ne ressemble pas à une adresse de site web.")
    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror as exc:
        raise RecipeImportError("Site introuvable — vérifie le lien.") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise RecipeImportError("Ce lien pointe vers une adresse non autorisée.")
    return url


def fetch_page(url: str) -> str:
    """Télécharge le HTML d'une page de recette.

    Args:
        url: URL publique déjà validée par :func:`ensure_public_url`.

    Returns:
        Le HTML de la page.

    Raises:
        RecipeImportError: En cas d'erreur réseau ou de réponse non HTML.
    """
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "fr-FR,fr;q=0.9"}
    try:
        with httpx.Client(
            follow_redirects=True, timeout=FETCH_TIMEOUT_S, headers=headers
        ) as client:
            resp = client.get(url)
    except httpx.HTTPError as exc:
        raise RecipeImportError("Impossible de joindre le site, réessaie dans un instant.") from exc
    # Les redirections peuvent mener ailleurs : on revalide l'hôte final.
    ensure_public_url(str(resp.url))
    if resp.status_code >= 400:
        raise RecipeImportError(
            f"Le site a refusé l'accès à la page (erreur {resp.status_code})."
        )
    if len(resp.content) > MAX_PAGE_BYTES:
        raise RecipeImportError("La page est trop volumineuse pour être analysée.")
    return resp.text


def _iter_nodes(data: Any) -> Iterable[dict]:
    if isinstance(data, list):
        for item in data:
            yield from _iter_nodes(item)
    elif isinstance(data, dict):
        yield data
        if "@graph" in data:
            yield from _iter_nodes(data["@graph"])


def _is_recipe(node: dict) -> bool:
    kind = node.get("@type")
    kinds = kind if isinstance(kind, list) else [kind]
    return "Recipe" in kinds


def _first_str(value: Any) -> Optional[str]:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        for item in value:
            found = _first_str(item)
            if found:
                return found
    if isinstance(value, dict):
        return _first_str(value.get("url") or value.get("@id"))
    return None


def parse_yield(value: Any) -> Optional[int]:
    """Extrait un nombre de personnes depuis ``recipeYield``.

    Args:
        value: ``"4 personnes"``, ``["1", "portion"]``, ``4``…

    Returns:
        Le nombre de portions, ou ``None`` si introuvable.
    """
    if isinstance(value, (int, float)):
        return int(value) if value > 0 else None
    if isinstance(value, list):
        for item in value:
            found = parse_yield(item)
            if found:
                return found
        return None
    if isinstance(value, str):
        match = re.search(r"\d+", value)
        if match and int(match.group()) > 0:
            return int(match.group())
    return None


def _clean_text(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = html_lib.unescape(re.sub(r"<[^>]+>", " ", value))
    return re.sub(r"\s+", " ", text).strip() or None


_TITLE_SUFFIX_RE = re.compile(
    r"\s*[:|–-]\s*(la meilleure recette|recette facile|recette de .*|marmiton|750g|jow)\s*$", re.I
)


def clean_title(title: Optional[str]) -> str:
    """Retire les suffixes SEO des titres (« : la meilleure recette »).

    Args:
        title: Titre brut.

    Returns:
        Titre nettoyé (``"Recette importée"`` si vide).
    """
    text = _clean_text(title) or ""
    return _TITLE_SUFFIX_RE.sub("", text).strip() or "Recette importée"


def extract_jsonld_recipe(page_html: str) -> Optional[JsonLdRecipe]:
    """Cherche un objet schema.org ``Recipe`` dans les blocs JSON-LD.

    Args:
        page_html: HTML complet de la page.

    Returns:
        ``JsonLdRecipe`` si trouvé avec au moins un ingrédient, sinon ``None``.
    """
    for block in _LD_JSON_RE.findall(page_html):
        try:
            data = json.loads(block.strip())
        except json.JSONDecodeError:
            continue
        for node in _iter_nodes(data):
            if not _is_recipe(node):
                continue
            raw_ingredients = node.get("recipeIngredient") or node.get("ingredients") or []
            if isinstance(raw_ingredients, str):
                raw_ingredients = [raw_ingredients]
            ingredients = [
                _clean_text(str(i)) for i in raw_ingredients if _clean_text(str(i))
            ]
            if not ingredients:
                continue
            keywords = node.get("keywords") or []
            if isinstance(keywords, str):
                keywords = [k.strip() for k in keywords.split(",") if k.strip()]
            category = _first_str(node.get("recipeCategory"))
            return JsonLdRecipe(
                name=clean_title(node.get("name")),
                ingredients=ingredients,
                servings=parse_yield(node.get("recipeYield")),
                description=_clean_text(node.get("description")),
                image_url=_first_str(node.get("image")),
                category=_clean_text(category),
                keywords=[str(k) for k in keywords][:20],
            )
    return None


def extract_visible_text(page_html: str, max_chars: int = 60_000) -> str:
    """Réduit une page HTML à son texte lisible (pour l'analyse par IA).

    Args:
        page_html: HTML complet.
        max_chars: Longueur maximale conservée.

    Returns:
        Texte brut normalisé.
    """
    text = re.sub(r"<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", page_html, flags=re.S | re.I)
    text = re.sub(r"<br\s*/?>|</(p|li|div|h\d|tr)>", "\n", text, flags=re.I)
    text = html_lib.unescape(re.sub(r"<[^>]+>", " ", text))
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n", text).strip()
    return text[:max_chars]


def servings_hint_from_url(url: str) -> Optional[int]:
    """Lit un nombre de couverts éventuellement présent dans l'URL (Jow : ``coversCount``).

    Args:
        url: URL de la recette.

    Returns:
        Nombre de couverts ou ``None``.
    """
    params = parse_qs(urlparse(url).query)
    for key in ("coversCount", "portions", "servings", "nb_personnes"):
        values = params.get(key)
        if values and values[0].isdigit() and int(values[0]) > 0:
            return int(values[0])
    return None
