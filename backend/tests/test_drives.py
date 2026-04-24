import pytest

from app.services import drive as drive_service_module
from app.services.drives.base import BaseDrive


class DummyDrive(BaseDrive):
    name = "carrefour"

    def test_connection(self):
        return {"success": True, "message": "dummy", "email": self.email}

    def search_product(self, query):
        return [{"title": f"hit: {query}", "price": "1€", "url": "u"}]

    def add_items_to_cart(self, items):
        return {
            "success": True,
            "drive": self.name,
            "items_added": len(items),
            "items_failed": [],
            "errors": [],
            "cart_url": "https://example/cart",
        }


@pytest.fixture(autouse=True)
def stub_driver(monkeypatch):
    monkeypatch.setitem(drive_service_module.DRIVE_CLASSES, "carrefour", DummyDrive)


def test_create_config_encrypts_credentials(client, db_session):
    res = client.post(
        "/api/drives/configs",
        json={
            "name": "carrefour",
            "display_name": "Carrefour Drive",
            "enabled": True,
            "default_store": "Paris 15",
            "credentials": {"email": "a@b.c", "password": "secret"},
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "carrefour"
    assert "credentials" not in data
    assert "password" not in data

    from app.models.drive_config import DriveConfig

    stored = db_session.query(DriveConfig).filter_by(name="carrefour").one()
    assert stored.credentials_encrypted
    assert "secret" not in stored.credentials_encrypted


def test_duplicate_config_rejected(client):
    payload = {"name": "carrefour", "credentials": {"email": "a@b"}}
    assert client.post("/api/drives/configs", json=payload).status_code == 201
    assert client.post("/api/drives/configs", json=payload).status_code == 409


def test_unsupported_drive_rejected(client):
    res = client.post("/api/drives/configs", json={"name": "monoprix"})
    assert res.status_code == 400


def test_test_connection_uses_decrypted_credentials(client):
    client.post(
        "/api/drives/configs",
        json={"name": "carrefour", "credentials": {"email": "me@x.y", "password": "pw"}},
    )
    res = client.post("/api/drives/carrefour/test-connection")
    assert res.status_code == 200
    assert res.json() == {"success": True, "message": "dummy", "email": "me@x.y"}


def test_search_returns_results(client):
    client.post("/api/drives/configs", json={"name": "carrefour", "credentials": {}})
    res = client.post("/api/drives/carrefour/search?query=lait")
    assert res.status_code == 200
    assert res.json()["results"][0]["title"] == "hit: lait"


def test_test_connection_missing_config(client):
    assert client.post("/api/drives/carrefour/test-connection").status_code == 404
