from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Courses App"
    app_version: str = "1.0.0"
    debug: bool = False

    database_url: str = f"sqlite:///{Path.home() / 'courses-app' / 'data.db'}"

    # Origines autorisées. Volontairement restreint au dev local : ouvrir à "*"
    # doit être un geste explicite, jamais le défaut d'un backend déployé.
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
    ]
    cors_allow_credentials: bool = True

    encryption_key: str = "dev-only-insecure-key-change-me-in-production-please!!"

    # --- Authentification (Supabase Auth) ---
    # Active par défaut : un déploiement mal configuré doit échouer au
    # démarrage, pas servir une API ouverte.
    auth_enabled: bool = True
    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_jwt_audience: str = "authenticated"

    frontend_dist: Path = Path.home() / "courses-app" / "frontend" / "dist"

    playwright_headless: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_allows_any_origin(self) -> bool:
        """Indique si la configuration ouvre le CORS à toutes les origines."""
        return "*" in self.cors_origins

    @property
    def effective_cors_allow_credentials(self) -> bool:
        """Concilie ``allow_credentials`` et l'usage du joker ``*``.

        Les navigateurs rejettent la combinaison ``Access-Control-Allow-Origin: *``
        avec ``Allow-Credentials: true``. Plutôt que de produire une configuration
        silencieusement inopérante, on désactive les credentials dans ce cas.

        Returns:
            ``True`` si les credentials cross-origin peuvent réellement être
            autorisés.
        """
        if self.cors_allows_any_origin:
            return False
        return self.cors_allow_credentials


@lru_cache
def get_settings() -> "Settings":
    return Settings()
