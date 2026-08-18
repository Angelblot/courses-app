"""Authentification des requêtes via les JWT émis par Supabase Auth.

Le backend ne délivre aucun jeton : il se contente de vérifier ceux que le
client obtient auprès de Supabase. Deux formats de signature sont acceptés :

* asymétrique (``RS256``/``ES256``) — le standard actuel ; les clés publiques
  sont récupérées sur le JWKS du projet et mises en cache ;
* symétrique (``HS256``) — les projets historiques, via ``SUPABASE_JWT_SECRET``.

L'authentification est active par défaut. Un démarrage sans configuration
valable échoue bruyamment plutôt que d'exposer l'API en silence.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings

# Durée de vie du cache JWKS. Supabase ne fait pas tourner ses clés souvent ;
# 10 minutes suffisent à absorber une rotation sans marteler l'endpoint.
_JWKS_TTL_SECONDS = 600

_jwks_cache: Dict[str, Any] = {"fetched_at": 0.0, "keys": {}}

_bearer = HTTPBearer(auto_error=False)


class AuthConfigurationError(RuntimeError):
    """Levée au démarrage quand l'auth est active mais mal configurée."""


@dataclass(frozen=True)
class AuthUser:
    """Utilisateur authentifié, extrait des claims du JWT.

    Attributes:
        id: UUID Supabase de l'utilisateur (claim ``sub``).
        email: Adresse e-mail si présente dans le jeton.
        claims: Claims bruts, pour les usages avancés (rôles, métadonnées).
    """

    id: str
    email: Optional[str] = None
    claims: Dict[str, Any] = field(default_factory=dict)


def validate_auth_settings(settings: Settings) -> None:
    """Vérifie que l'auth dispose de quoi valider un jeton.

    Args:
        settings: Configuration applicative.

    Raises:
        AuthConfigurationError: Si l'auth est active sans ``SUPABASE_URL`` ni
            ``SUPABASE_JWT_SECRET``.
    """
    if not settings.auth_enabled:
        return
    if not settings.supabase_url and not settings.supabase_jwt_secret:
        raise AuthConfigurationError(
            "Authentification activée mais non configurée : renseigne SUPABASE_URL "
            "(clés asymétriques) ou SUPABASE_JWT_SECRET (clés symétriques). "
            "Pour un backend de développement ouvert, mets explicitement "
            "AUTH_ENABLED=false."
        )


def _jwks_url(settings: Settings) -> str:
    return f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"


def _fetch_jwks(settings: Settings) -> Dict[str, Any]:
    """Récupère les clés publiques du projet, avec cache TTL.

    Args:
        settings: Configuration applicative.

    Returns:
        Dictionnaire ``kid`` → clé publique désérialisée.

    Raises:
        HTTPException: 503 si le JWKS est injoignable et qu'aucun cache
            utilisable n'est disponible.
    """
    now = time.monotonic()
    if _jwks_cache["keys"] and now - _jwks_cache["fetched_at"] < _JWKS_TTL_SECONDS:
        return _jwks_cache["keys"]

    try:
        response = httpx.get(_jwks_url(settings), timeout=5.0)
        response.raise_for_status()
        payload = response.json()
    except Exception as exc:  # réseau, DNS, JSON invalide…
        if _jwks_cache["keys"]:
            # Le cache est périmé mais reste préférable à un rejet massif.
            return _jwks_cache["keys"]
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Impossible de récupérer les clés de signature Supabase",
        ) from exc

    keys = {}
    for key_data in payload.get("keys", []):
        kid = key_data.get("kid")
        if not kid:
            continue
        keys[kid] = jwt.PyJWK(key_data).key

    _jwks_cache["keys"] = keys
    _jwks_cache["fetched_at"] = now
    return keys


def reset_jwks_cache() -> None:
    """Vide le cache JWKS — utile en test et après rotation de clés."""
    _jwks_cache["keys"] = {}
    _jwks_cache["fetched_at"] = 0.0


def _decode(token: str, settings: Settings) -> Dict[str, Any]:
    """Décode et vérifie un JWT Supabase.

    Args:
        token: Jeton brut, sans le préfixe ``Bearer``.
        settings: Configuration applicative.

    Returns:
        Les claims vérifiés.

    Raises:
        HTTPException: 401 si le jeton est illisible, expiré ou mal signé.
    """
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise _unauthorized("Jeton illisible") from exc

    algorithm = header.get("alg", "")
    options = {"verify_aud": True}
    issuer = f"{settings.supabase_url.rstrip('/')}/auth/v1" if settings.supabase_url else None

    try:
        if algorithm.startswith("HS"):
            if not settings.supabase_jwt_secret:
                raise _unauthorized("Jeton symétrique reçu mais SUPABASE_JWT_SECRET absent")
            key: Any = settings.supabase_jwt_secret
        else:
            if not settings.supabase_url:
                raise _unauthorized("Jeton asymétrique reçu mais SUPABASE_URL absent")
            kid = header.get("kid")
            keys = _fetch_jwks(settings)
            if kid not in keys:
                # Rotation possible : on force un rafraîchissement avant d'abandonner.
                reset_jwks_cache()
                keys = _fetch_jwks(settings)
            if kid not in keys:
                raise _unauthorized("Clé de signature inconnue")
            key = keys[kid]

        return jwt.decode(
            token,
            key,
            algorithms=[algorithm],
            audience=settings.supabase_jwt_audience,
            issuer=issuer,
            options=options,
        )
    except jwt.ExpiredSignatureError as exc:
        raise _unauthorized("Session expirée") from exc
    except jwt.InvalidTokenError as exc:
        raise _unauthorized("Jeton invalide") from exc


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> AuthUser:
    """Dépendance FastAPI exigeant un JWT Supabase valide.

    Args:
        credentials: En-tête ``Authorization: Bearer <jwt>`` si présent.
        settings: Configuration applicative.

    Returns:
        L'utilisateur authentifié.

    Raises:
        HTTPException: 401 si le jeton est absent ou invalide.
    """
    if not settings.auth_enabled:
        return AuthUser(id="dev-user", email="dev@localhost", claims={})

    if credentials is None or not credentials.credentials:
        raise _unauthorized("Authentification requise")

    claims = _decode(credentials.credentials, settings)
    subject = claims.get("sub")
    if not subject:
        raise _unauthorized("Jeton sans identifiant utilisateur")

    return AuthUser(id=subject, email=claims.get("email"), claims=claims)
