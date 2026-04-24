from app.core.security import decrypt_credentials, encrypt_credentials


def test_roundtrip_encrypt_decrypt():
    payload = {"email": "user@example.com", "password": "s3cret!"}
    token = encrypt_credentials(payload)
    assert "s3cret!" not in token
    assert decrypt_credentials(token) == payload


def test_decrypt_plain_json_fallback():
    # Supports old unencrypted rows (backward compat).
    import json

    raw = json.dumps({"email": "legacy@x.y"})
    assert decrypt_credentials(raw) == {"email": "legacy@x.y"}


def test_decrypt_none_returns_empty():
    assert decrypt_credentials(None) == {}
    assert decrypt_credentials("") == {}
