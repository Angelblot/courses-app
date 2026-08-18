"""Vérifie que l'API est réellement fermée et que le décodage JWT fonctionne."""

import datetime as dt

import jwt
import pytest

from app.core.config import get_settings
from tests.conftest import TEST_JWT_SECRET

ISSUER = "https://test-project.supabase.co/auth/v1"


def _token(**overrides) -> str:
    """Forge un JWT HS256 équivalent à celui émis par Supabase Auth."""
    now = dt.datetime.now(dt.timezone.utc)
    claims = {
        "sub": "00000000-0000-0000-0000-000000000042",
        "email": "angelo@example.com",
        "aud": "authenticated",
        "iss": ISSUER,
        "iat": now,
        "exp": now + dt.timedelta(hours=1),
    }
    claims.update(overrides)
    secret = overrides.pop("_secret", TEST_JWT_SECRET)
    return jwt.encode(claims, secret, algorithm="HS256")


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/products/"),
        ("get", "/api/lists/"),
        ("get", "/api/recipes/"),
        ("get", "/api/categories/"),
        ("get", "/api/drives/configs"),
        ("get", "/api/foods/"),
    ],
)
def test_api_refuse_les_requetes_sans_jeton(client_anon, method, path):
    response = getattr(client_anon, method)(path)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_ecriture_refusee_sans_jeton(client_anon):
    response = client_anon.delete("/api/products/1")
    assert response.status_code == 401


def test_health_reste_ouvert(client_anon):
    assert client_anon.get("/health").status_code == 200


def test_jeton_valide_accepte(client_anon):
    response = client_anon.get("/api/products/", headers=_auth(_token()))
    assert response.status_code == 200


def test_jeton_expire_refuse(client_anon):
    expired = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=2)
    token = _token(exp=expired, iat=expired - dt.timedelta(hours=1))
    response = client_anon.get("/api/products/", headers=_auth(token))
    assert response.status_code == 401
    assert "expir" in response.json()["detail"].lower()


def test_signature_invalide_refusee(client_anon):
    token = jwt.encode(
        {
            "sub": "abc",
            "aud": "authenticated",
            "iss": ISSUER,
            "exp": dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=1),
        },
        "mauvais-secret",
        algorithm="HS256",
    )
    assert client_anon.get("/api/products/", headers=_auth(token)).status_code == 401


def test_mauvaise_audience_refusee(client_anon):
    token = _token(aud="un-autre-projet")
    assert client_anon.get("/api/products/", headers=_auth(token)).status_code == 401


def test_mauvais_emetteur_refuse(client_anon):
    token = _token(iss="https://attaquant.example.com/auth/v1")
    assert client_anon.get("/api/products/", headers=_auth(token)).status_code == 401


def test_jeton_sans_sub_refuse(client_anon):
    token = _token()
    payload = jwt.decode(
        token, TEST_JWT_SECRET, algorithms=["HS256"], audience="authenticated", issuer=ISSUER
    )
    payload.pop("sub")
    forged = jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")
    response = client_anon.get("/api/products/", headers=_auth(forged))
    assert response.status_code == 401


def test_entete_malformee_refusee(client_anon):
    response = client_anon.get("/api/products/", headers={"Authorization": "Bearer pas-un-jwt"})
    assert response.status_code == 401


class TestConfigurationAuth:
    def test_demarrage_refuse_si_auth_active_sans_configuration(self):
        from app.core.auth import AuthConfigurationError, validate_auth_settings
        from app.core.config import Settings

        settings = Settings(auth_enabled=True, supabase_url="", supabase_jwt_secret="")
        with pytest.raises(AuthConfigurationError):
            validate_auth_settings(settings)

    def test_demarrage_autorise_si_auth_desactivee_explicitement(self):
        from app.core.auth import validate_auth_settings
        from app.core.config import Settings

        settings = Settings(auth_enabled=False, supabase_url="", supabase_jwt_secret="")
        validate_auth_settings(settings)  # ne lève pas


class TestConfigurationCORS:
    def test_joker_desactive_les_credentials(self):
        from app.core.config import Settings

        settings = Settings(cors_origins=["*"], cors_allow_credentials=True)
        assert settings.effective_cors_allow_credentials is False

    def test_origines_explicites_conservent_les_credentials(self):
        from app.core.config import Settings

        settings = Settings(
            cors_origins=["https://courses.example.com"], cors_allow_credentials=True
        )
        assert settings.effective_cors_allow_credentials is True

    def test_defaut_nest_pas_ouvert_a_tous(self):
        assert "*" not in get_settings().cors_origins
