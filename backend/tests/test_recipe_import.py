"""Tests de l'import automatique de recettes (lien + photo)."""
import json

import pytest

from app.services.recipe_import import llm, service, web
from app.services.recipe_import.ingredient_parser import parse_ingredient_line


def _page(recipe: dict, wrap_graph: bool = False) -> str:
    data = {"@context": "https://schema.org", "@graph": [{"@type": "WebSite"}, recipe]} if wrap_graph else recipe
    return (
        "<html><head>"
        '<script type="application/ld+json">{"@type": "Organization"}</script>'
        f'<script type="application/ld+json">{json.dumps(data)}</script>'
        "</head><body>Recette</body></html>"
    )


JOW_RECIPE = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    "name": "Poêlée de patates douces, feta &amp; œuf au plat",
    "recipeYield": ["1", "portion"],
    "recipeCategory": "Veggie - grain",
    "image": ["https://static.jow.fr/recipe.jpg"],
    "recipeIngredient": ["200 g Patate douce", "1   Œuf", "40 g Feta", "1/4 gou. Ail"],
}

MARMITON_RECIPE = {
    "@type": "Recipe",
    "name": "Jambon blanc pané",
    "recipeYield": "4 personnes",
    "recipeCategory": "Entrée",
    "recipeIngredient": ["4 tranches de jambon blanc", "2 oeufs"],
}


@pytest.fixture
def no_llm(monkeypatch):
    monkeypatch.setattr(llm, "is_available", lambda: False)


@pytest.fixture
def fake_page(monkeypatch):
    """Court-circuite le réseau : ``fake_page(html)`` définit la page renvoyée."""
    monkeypatch.setattr(service, "ensure_public_url", lambda url: url)
    holder = {}
    monkeypatch.setattr(service, "fetch_page", lambda url: holder["html"])

    def _set(html: str) -> None:
        holder["html"] = html

    return _set


@pytest.mark.parametrize(
    "line,expected",
    [
        ("200 g Patate douce", ("Patate douce", 200, "g")),
        ("1/4 gou. Ail", ("Ail", 0.25, "gousse")),
        ("20 cl de crème liquide", ("Crème liquide", 200, "ml")),
        ("1,5 kg de pommes de terre", ("Pommes de terre", 1500, "g")),
        ("2 cuillères à soupe d'huile d'olive", ("Huile d'olive", 2, "cuillère à soupe")),
        ("½ sachet de paprika fumé", ("Paprika fumé", 0.5, "sachet")),
        ("Sel", ("Sel", 1, "unité")),
    ],
)
def test_parse_ingredient_line(line, expected):
    parsed = parse_ingredient_line(line)
    assert (parsed.name, parsed.quantity, parsed.unit) == expected


def test_parse_ingredient_line_guesses_rayon():
    assert parse_ingredient_line("500 g de pommes de terre").rayon == "Fruits & légumes"
    assert parse_ingredient_line("1 paquet de dés de dinde").rayon == "Boucherie"
    assert parse_ingredient_line("1 pot de yaourt à la grecque").rayon == "Crèmerie"


def test_extract_jsonld_from_graph():
    found = web.extract_jsonld_recipe(_page(MARMITON_RECIPE, wrap_graph=True))
    assert found is not None
    assert found.name == "Jambon blanc pané"
    assert found.servings == 4
    assert found.ingredients == ["4 tranches de jambon blanc", "2 oeufs"]


def test_extract_jsonld_returns_none_without_recipe():
    assert web.extract_jsonld_recipe("<html><body>Pas de recette</body></html>") is None


def test_servings_hint_from_url():
    assert web.servings_hint_from_url("https://jow.fr/recipes/x?coversCount=2") == 2
    assert web.servings_hint_from_url("https://jow.fr/recipes/x") is None


@pytest.mark.parametrize("url", ["ftp://example.com/x", "http://127.0.0.1/recette", "http://localhost:8000/"])
def test_ensure_public_url_rejects_unsafe(url):
    with pytest.raises(web.RecipeImportError):
        web.ensure_public_url(url)


def test_import_url_without_llm_uses_parser(client, no_llm, fake_page):
    fake_page(_page(JOW_RECIPE))
    res = client.post("/api/recipes/import/url", json={"url": "https://jow.fr/recipes/x?coversCount=2"})
    assert res.status_code == 200, res.text
    draft = res.json()
    assert draft["name"] == "Poêlée de patates douces, feta & œuf au plat"
    assert draft["source"] == "url"
    assert draft["servings_default"] == 2  # coversCount de l'URL
    assert draft["image_url"] == "https://static.jow.fr/recipe.jpg"
    patate = draft["ingredients"][0]
    # Quantités publiées pour 1 portion -> 200 g par personne.
    assert (patate["name"], patate["quantity_per_serving"], patate["unit"]) == ("Patate douce", 200, "g")
    assert draft["warnings"]


def test_import_url_divides_quantities_by_servings(client, no_llm, fake_page):
    fake_page(_page(MARMITON_RECIPE))
    draft = client.post("/api/recipes/import/url", json={"url": "https://www.marmiton.org/r.aspx"}).json()
    assert draft["servings_default"] == 4
    assert draft["category"] == "Entrées"
    jambon = draft["ingredients"][0]
    assert (jambon["quantity_per_serving"], jambon["unit"]) == (1, "tranche")


def test_import_url_uses_llm_when_available(client, fake_page, monkeypatch):
    fake_page(_page(MARMITON_RECIPE))
    monkeypatch.setattr(llm, "is_available", lambda: True)
    monkeypatch.setattr(
        llm,
        "normalize_ingredients",
        lambda name, servings, lines: llm.LlmRecipe(
            is_recipe=True,
            name=name,
            servings=servings,
            ingredients=[
                llm.LlmIngredient(name="Jambon blanc", quantity=4, unit="tranche", rayon="Boucherie", pantry=False),
                llm.LlmIngredient(name="Gruyère râpé", quantity=125, unit="g", rayon="Crèmerie", pantry=False),
                llm.LlmIngredient(name="Huile", quantity=2, unit="cuillère à soupe", rayon="Épicerie", pantry=True),
            ],
        ),
    )
    draft = client.post("/api/recipes/import/url", json={"url": "https://www.marmiton.org/r.aspx"}).json()
    names = [i["name"] for i in draft["ingredients"]]
    assert names == ["Jambon blanc", "Gruyère râpé", "Huile"]
    assert draft["ingredients"][1]["quantity_per_serving"] == 31.25
    assert draft["ingredients"][2]["category"] == "Placard"


def test_import_url_without_jsonld_and_without_llm_fails_cleanly(client, no_llm, fake_page):
    fake_page("<html><body>Une recette sans données structurées</body></html>")
    res = client.post("/api/recipes/import/url", json={"url": "https://blog.example.com/r"})
    assert res.status_code == 422
    assert "format lisible" in res.json()["detail"]


def test_import_photo(client, monkeypatch):
    captured = {}

    def fake_from_image(image_b64, media_type):
        captured["media_type"] = media_type
        return llm.LlmRecipe(
            is_recipe=True,
            name="Dinde rôtie & crema de coriandre",
            servings=2,
            category="Plats",
            ingredients=[
                llm.LlmIngredient(name="Pommes de terre", quantity=500, unit="g", rayon="Fruits & légumes", pantry=False),
                llm.LlmIngredient(name="Oignon", quantity=1, unit="unité", rayon="Fruits & légumes", pantry=False),
            ],
        )

    monkeypatch.setattr(llm, "recipe_from_image", fake_from_image)
    res = client.post(
        "/api/recipes/import/photo",
        files={"file": ("fiche.jpg", b"\xff\xd8\xff fake jpeg", "image/jpeg")},
    )
    assert res.status_code == 200, res.text
    draft = res.json()
    assert captured["media_type"] == "image/jpeg"
    assert draft["source"] == "photo"
    assert draft["servings_default"] == 2
    assert draft["ingredients"][0]["quantity_per_serving"] == 250
    assert draft["ingredients"][1]["quantity_per_serving"] == 0.5


def test_import_photo_rejects_non_image(client):
    res = client.post(
        "/api/recipes/import/photo",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert res.status_code == 422


def test_import_photo_without_api_key(client, monkeypatch):
    monkeypatch.setattr(llm, "_api_key", lambda: None)
    res = client.post(
        "/api/recipes/import/photo",
        files={"file": ("fiche.jpg", b"\xff\xd8\xff", "image/jpeg")},
    )
    assert res.status_code == 422
    assert "ANTHROPIC_API_KEY" in res.json()["detail"]
