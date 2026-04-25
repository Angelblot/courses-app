"""Tests CRUD pour /api/recipes/."""


def _payload(**overrides):
    base = {
        "name": "Pâtes bolognaise",
        "description": "Classique familial.",
        "servings_default": 4,
        "category": "Plats",
        "ingredients": [
            {
                "name": "Spaghetti",
                "quantity_per_serving": 100,
                "unit": "g",
                "rayon": "Épicerie",
                "category": "Pâtes",
            },
            {
                "name": "Viande hachée",
                "quantity_per_serving": 125,
                "unit": "g",
                "rayon": "Boucherie",
                "category": "Viande",
            },
        ],
    }
    base.update(overrides)
    return base


def test_list_recipes_empty(client):
    res = client.get("/api/recipes/")
    assert res.status_code == 200
    assert res.json() == []


def test_create_and_get_recipe(client):
    res = client.post("/api/recipes/", json=_payload())
    assert res.status_code == 201
    created = res.json()
    assert created["id"] > 0
    assert created["name"] == "Pâtes bolognaise"
    assert len(created["ingredients"]) == 2
    assert created["ingredients"][0]["name"] == "Spaghetti"

    fetched = client.get(f"/api/recipes/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == created["id"]
    assert len(fetched.json()["ingredients"]) == 2


def test_list_returns_created_recipe(client):
    client.post("/api/recipes/", json=_payload(name="Tarte aux pommes"))
    res = client.get("/api/recipes/")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["name"] == "Tarte aux pommes"


def test_update_recipe(client):
    created = client.post("/api/recipes/", json=_payload()).json()

    upd = client.put(
        f"/api/recipes/{created['id']}",
        json={"name": "Pâtes carbonara", "servings_default": 2},
    )
    assert upd.status_code == 200
    assert upd.json()["name"] == "Pâtes carbonara"
    assert upd.json()["servings_default"] == 2
    # ingrédients inchangés tant que non fournis
    assert len(upd.json()["ingredients"]) == 2


def test_update_recipe_replaces_ingredients(client):
    created = client.post("/api/recipes/", json=_payload()).json()

    upd = client.put(
        f"/api/recipes/{created['id']}",
        json={
            "ingredients": [
                {
                    "name": "Riz",
                    "quantity_per_serving": 80,
                    "unit": "g",
                    "rayon": "Épicerie",
                    "category": "Riz",
                }
            ]
        },
    )
    assert upd.status_code == 200
    assert len(upd.json()["ingredients"]) == 1
    assert upd.json()["ingredients"][0]["name"] == "Riz"


def test_delete_recipe(client):
    created = client.post("/api/recipes/", json=_payload()).json()
    res = client.delete(f"/api/recipes/{created['id']}")
    assert res.status_code == 200
    assert res.json() == {"ok": True}

    assert client.get(f"/api/recipes/{created['id']}").status_code == 404


def test_recipe_not_found(client):
    assert client.get("/api/recipes/999").status_code == 404
    assert client.put("/api/recipes/999", json={"name": "x"}).status_code == 404
    assert client.delete("/api/recipes/999").status_code == 404
