from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Courses App"
    app_version: str = "1.0.0"
    debug: bool = False

    database_url: str = f"sqlite:///{Path.home() / 'courses-app' / 'data.db'}"

    cors_origins: List[str] = ["*"]
    cors_allow_credentials: bool = True

    encryption_key: str = "dev-only-insecure-key-change-me-in-production-please!!"

    frontend_dist: Path = Path.home() / "courses-app" / "frontend" / "dist"

    playwright_headless: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> "Settings":
    return Settings()
