def test_list_products_empty(client):
    res = client.get("/api/products/")
    assert res.status_code == 200
    assert res.json() == []


def test_create_and_list_product(client):
    res = client.post("/api/products/", json={"name": "Pommes", "category": "Fruits"})
    assert res.status_code == 201
    product = res.json()
    assert product["name"] == "Pommes"
    assert product["favorite"] is False
    assert product["id"]

    listed = client.get("/api/products/").json()
    assert len(listed) == 1
    assert listed[0]["name"] == "Pommes"


def test_update_product(client):
    created = client.post("/api/products/", json={"name": "Lait"}).json()
    res = client.put(
        f"/api/products/{created['id']}",
        json={"favorite": True, "default_quantity": 3},
    )
    assert res.status_code == 200
    updated = res.json()
    assert updated["favorite"] is True
    assert updated["default_quantity"] == 3


def test_delete_product(client):
    created = client.post("/api/products/", json={"name": "Pain"}).json()
    res = client.delete(f"/api/products/{created['id']}")
    assert res.status_code == 200
    assert client.get(f"/api/products/{created['id']}").status_code == 404


def test_favorite_only_filter(client):
    client.post("/api/products/", json={"name": "A", "favorite": True})
    client.post("/api/products/", json={"name": "B", "favorite": False})
    res = client.get("/api/products/?favorite_only=true")
    assert res.status_code == 200
    names = [p["name"] for p in res.json()]
    assert names == ["A"]


def test_product_name_required(client):
    res = client.post("/api/products/", json={"name": ""})
    assert res.status_code == 422


def test_canonical_category_label_resolves(client):
    res = client.post(
        "/api/products/",
        json={"name": "Yaourt", "category": "Produits laitiers"},
    )
    assert res.status_code == 201
    product = res.json()
    assert product["category_key"] == "pls"
    assert product["category_label"] == "Produits laitiers"
