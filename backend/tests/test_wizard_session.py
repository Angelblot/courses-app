"""Tests des sessions du wizard de génération."""


def _create_recipe(client, **overrides):
    payload = {
        "name": "Pâtes bolognaise",
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
    payload.update(overrides)
    return client.post("/api/recipes/", json=payload).json()


def _create_product(client, **overrides):
    payload = {"name": "Lait", "default_quantity": 1, "favorite": False, "unit": "L"}
    payload.update(overrides)
    return client.post("/api/products/", json=payload).json()


def test_create_session_consolidates_recipes(client):
    recipe = _create_recipe(client)

    res = client.post(
        "/api/wizard/sessions",
        json={
            "recipes": [{"recipe_id": recipe["id"], "servings": 2}],
            "quotidien": [],
            "extras": [],
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["id"] > 0
    assert body["status"] == "pending"

    items = {it["name"]: it for it in body["consolidated_items"]}
    assert items["Spaghetti"]["quantity"] == 200
    assert items["Spaghetti"]["unit"] == "g"
    assert items["Viande hachée"]["quantity"] == 250


def test_create_session_with_quotidien_and_extras(client):
    product = _create_product(client, name="Lait")

    res = client.post(
        "/api/wizard/sessions",
        json={
            "recipes": [],
            "quotidien": [
                {"product_id": product["id"], "needed": True, "quantity": 2}
            ],
            "extras": [
                {
                    "name": "Bananes",
                    "quantity": 6,
                    "unit": "unité",
                    "rayon": "Fruits & légumes",
                    "category": "Fruits",
                }
            ],
        },
    )
    assert res.status_code == 201
    items = res.json()["consolidated_items"]
    by_name = {it["name"]: it for it in items}
    assert by_name["Lait"]["quantity"] == 2
    assert by_name["Lait"]["product_id"] == product["id"]
    assert by_name["Bananes"]["quantity"] == 6
    assert by_name["Bananes"]["product_id"] is None


def test_create_session_quotidien_not_needed_skipped(client):
    product = _create_product(client, name="Café")

    res = client.post(
        "/api/wizard/sessions",
        json={
            "recipes": [],
            "quotidien": [
                {"product_id": product["id"], "needed": False, "quantity": 1}
            ],
            "extras": [],
        },
    )
    assert res.status_code == 201
    assert res.json()["consolidated_items"] == []


def test_get_session(client):
    recipe = _create_recipe(client)
    created = client.post(
        "/api/wizard/sessions",
        json={
            "recipes": [{"recipe_id": recipe["id"], "servings": 1}],
            "quotidien": [],
            "extras": [],
        },
    ).json()

    res = client.get(f"/api/wizard/sessions/{created['id']}")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == created["id"]
    assert len(body["consolidated_items"]) == 2
    assert body["payload"]["recipes"][0]["recipe_id"] == recipe["id"]


def test_get_session_not_found(client):
    assert client.get("/api/wizard/sessions/9999").status_code == 404


def test_generate_creates_shopping_list(client):
    product = _create_product(client, name="Lait")
    session = client.post(
        "/api/wizard/sessions",
        json={
            "recipes": [],
            "quotidien": [
                {"product_id": product["id"], "needed": True, "quantity": 2}
            ],
            "extras": [],
        },
    ).json()

    res = client.post(
        f"/api/wizard/sessions/{session['id']}/generate",
        json={"drives": ["carrefour", "leclerc"]},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["job_id"] == f"wizard-{session['id']}"
    assert body["list_id"] > 0
    assert body["drives"] == ["carrefour", "leclerc"]

    fetched_list = client.get(f"/api/lists/{body['list_id']}").json()
    assert len(fetched_list["items"]) == 1
    assert fetched_list["items"][0]["product"]["id"] == product["id"]
    assert fetched_list["items"][0]["quantity"] == 2


def test_session_results(client):
    product = _create_product(client, name="Lait")
    session = client.post(
        "/api/wizard/sessions",
        json={
            "recipes": [],
            "quotidien": [
                {"product_id": product["id"], "needed": True, "quantity": 1}
            ],
            "extras": [
                {
                    "name": "Bananes",
                    "quantity": 6,
                    "unit": "unité",
                    "rayon": "Fruits & légumes",
                    "category": "Fruits",
                }
            ],
        },
    ).json()

    client.post(
        f"/api/wizard/sessions/{session['id']}/generate",
        json={"drives": ["carrefour"]},
    )

    res = client.get(f"/api/wizard/sessions/{session['id']}/results")
    assert res.status_code == 200
    body = res.json()
    assert body["session_id"] == session["id"]
    assert body["status"] == "generating"
    assert "carrefour" in body["drives"]
    # L'extra sans product_id est conservé dans les missing
    missing_names = [m["name"] for m in body["drives"]["carrefour"]["missing"]]
    assert "Bananes" in missing_names


def test_generate_session_not_found(client):
    res = client.post(
        "/api/wizard/sessions/9999/generate", json={"drives": ["carrefour"]}
    )
    assert res.status_code == 404


def test_pantry_and_product_overrides_persist_without_double_counting(client):
    product = _create_product(client, name='Spaghetti paquet 500g', unit='unité')
    recipe = _create_recipe(client)
    override = {'ingredients': [{'recipe_id': recipe['id'], 'name': 'Spaghetti', 'unit': 'g'}],
                'product_id': product['id'], 'quantity': 2}
    owned = {'ingredients': [{'recipe_id': recipe['id'], 'name': 'Viande hachée', 'unit': 'g'}], 'owned': True}
    response = client.post('/api/wizard/sessions', json={
        'recipes': [{'recipe_id': recipe['id'], 'servings': 4}],
        'ingredient_overrides': [override, owned],
        'quotidien': [{'product_id': product['id'], 'quantity': 1, 'needed': True}],
    })
    assert response.status_code == 201
    result = response.json()
    assert len(result['consolidated_items']) == 1
    assert result['consolidated_items'][0]['quantity'] == 3
    assert result['consolidated_items'][0]['unit'] == 'unité'
    stored = client.get(f"/api/wizard/sessions/{result['id']}").json()
    assert stored['payload']['ingredient_overrides'][1]['owned'] is True
    assert stored['consolidated_items'] == result['consolidated_items']


def test_ingredient_choice_cannot_reference_unselected_recipe(client):
    recipe = _create_recipe(client)
    response = client.post('/api/wizard/sessions', json={'ingredient_overrides': [
        {'ingredients': [{'recipe_id': recipe['id'], 'name': 'Spaghetti', 'unit': 'g'}], 'owned': True}
    ]})
    assert response.status_code == 422


def test_grouped_choice_across_recipes_adds_pack_only_once(client):
    first, second = _create_recipe(client), _create_recipe(client, name='Autres pâtes')
    product = _create_product(client, name='Spaghetti', unit='unité')
    response = client.post('/api/wizard/sessions', json={
        'recipes': [{'recipe_id': r['id'], 'servings': 2} for r in [first, second]],
        'ingredient_overrides': [{'ingredients': [
            {'recipe_id': r['id'], 'name': 'Spaghetti', 'unit': 'g'} for r in [first, second]],
            'product_id': product['id'], 'quantity': 1}],
    })
    assert response.status_code == 201
    items = response.json()['consolidated_items']
    assert next(i for i in items if i['product_id'] == product['id'])['quantity'] == 1
    assert next(i for i in items if i['name'] == 'Viande hachée')['quantity'] == 500
