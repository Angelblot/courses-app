def test_list_categories_seeded(client):
    res = client.get("/api/categories/")
    assert res.status_code == 200
    keys = [c["key"] for c in res.json()]
    # seed fournit au minimum les 10 catégories canoniques
    for expected in [
        "fruits_legumes",
        "pls",
        "charcuterie",
        "boissons",
        "epicerie",
        "droguerie",
        "parfumerie",
        "maison",
        "surgeles",
        "autre",
    ]:
        assert expected in keys


def test_list_categories_returns_counts(client):
    client.post("/api/products/", json={"name": "Yaourt", "category": "Produits laitiers"})
    client.post("/api/products/", json={"name": "Lait", "category": "Produits laitiers"})
    res = client.get("/api/categories/").json()
    pls = next(c for c in res if c["key"] == "pls")
    assert pls["count"] == 2


def test_create_category(client):
    res = client.post(
        "/api/categories/",
        json={"key": "apero", "label": "Apéritif", "icon": "wine", "display_order": 5},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["key"] == "apero"
    assert body["label"] == "Apéritif"
    assert body["icon"] == "wine"
    assert body["display_order"] == 5
    assert body["count"] == 0

    listed = client.get("/api/categories/").json()
    assert any(c["key"] == "apero" for c in listed)


def test_create_category_duplicate_conflict(client):
    client.post(
        "/api/categories/",
        json={"key": "apero", "label": "Apéritif", "icon": "wine"},
    )
    res = client.post(
        "/api/categories/",
        json={"key": "apero", "label": "Autre label", "icon": "wine"},
    )
    assert res.status_code == 409


def test_create_category_invalid_key(client):
    res = client.post(
        "/api/categories/",
        json={"key": "Apéro Bar", "label": "x", "icon": "y"},
    )
    assert res.status_code == 422


def test_update_category(client):
    res = client.put(
        "/api/categories/pls",
        json={"label": "Laitages", "display_order": 10},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["label"] == "Laitages"
    assert body["display_order"] == 10
    assert body["icon"] == "milk"  # non modifié


def test_update_category_not_found(client):
    res = client.put("/api/categories/unknown", json={"label": "X"})
    assert res.status_code == 404


def test_delete_category_empty_ok(client):
    client.post(
        "/api/categories/",
        json={"key": "apero", "label": "Apéritif", "icon": "wine"},
    )
    res = client.delete("/api/categories/apero")
    assert res.status_code == 204
    listed = client.get("/api/categories/").json()
    assert not any(c["key"] == "apero" for c in listed)


def test_delete_category_with_products_conflict(client):
    client.post("/api/products/", json={"name": "Yaourt", "category": "Produits laitiers"})
    res = client.delete("/api/categories/pls")
    assert res.status_code == 409


def test_delete_category_not_found(client):
    res = client.delete("/api/categories/unknown")
    assert res.status_code == 404
