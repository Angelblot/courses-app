def _new_product(client, **overrides):
    payload = {"name": "Pommes", "default_quantity": 1, "favorite": False}
    payload.update(overrides)
    return client.post("/api/products/", json=payload).json()


def test_create_and_get_list(client):
    res = client.post("/api/lists/", json={"name": "Semaine"})
    assert res.status_code == 201
    lst = res.json()
    assert lst["name"] == "Semaine"
    assert lst["items"] == []

    fetched = client.get(f"/api/lists/{lst['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == lst["id"]


def test_add_and_update_item(client):
    product = _new_product(client, name="Lait")
    lst = client.post("/api/lists/", json={"name": "Courses"}).json()

    add = client.post(
        f"/api/lists/{lst['id']}/items",
        json={"product_id": product["id"], "quantity": 2},
    )
    assert add.status_code == 201
    item = add.json()
    assert item["quantity"] == 2
    assert item["checked"] is False

    upd = client.put(
        f"/api/lists/{lst['id']}/items/{item['id']}",
        json={"checked": True, "price_found": 1.25},
    )
    assert upd.status_code == 200
    assert upd.json()["checked"] is True
    assert upd.json()["price_found"] == 1.25


def test_delete_item(client):
    product = _new_product(client, name="Pain")
    lst = client.post("/api/lists/", json={"name": "L1"}).json()
    item = client.post(
        f"/api/lists/{lst['id']}/items",
        json={"product_id": product["id"]},
    ).json()

    res = client.delete(f"/api/lists/{lst['id']}/items/{item['id']}")
    assert res.status_code == 200
    assert client.get(f"/api/lists/{lst['id']}").json()["items"] == []


def test_generate_from_favorites(client):
    fav = _new_product(client, name="Bananes", favorite=True, default_quantity=4)
    _new_product(client, name="Sel", favorite=False)
    lst = client.post("/api/lists/", json={"name": "Hebdo"}).json()

    res = client.post(f"/api/lists/{lst['id']}/generate-from-favorites")
    assert res.status_code == 200
    assert res.json() == {"added": 1}

    items = client.get(f"/api/lists/{lst['id']}").json()["items"]
    assert len(items) == 1
    assert items[0]["product"]["id"] == fav["id"]
    assert items[0]["quantity"] == 4

    # idempotent: no duplicates
    again = client.post(f"/api/lists/{lst['id']}/generate-from-favorites")
    assert again.json() == {"added": 0}


def test_list_not_found(client):
    assert client.get("/api/lists/999").status_code == 404
    assert (
        client.post("/api/lists/999/items", json={"product_id": 1}).status_code == 404
    )
