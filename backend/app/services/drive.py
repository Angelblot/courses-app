from typing import Any, Dict, List

from fastapi import HTTPException, status

from app.core.security import decrypt_credentials, encrypt_credentials
from app.models.drive_config import DriveConfig
from app.repositories.drive_config import DriveConfigRepository
from app.schemas.cart import CartItem
from app.schemas.drive_config import DriveConfigCreate, DriveConfigUpdate
from app.services.drives import DRIVE_CLASSES
from app.services.drives.base import BaseDrive


class UnsupportedDriveError(HTTPException):
    def __init__(self, drive_name: str):
        super().__init__(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Drive non supporté: {drive_name}",
        )


class DriveService:
    def __init__(self, repo: DriveConfigRepository):
        self.repo = repo

    def list_configs(self) -> List[DriveConfig]:
        return self.repo.list()

    def create_config(self, data: DriveConfigCreate) -> DriveConfig:
        if data.name not in DRIVE_CLASSES:
            raise UnsupportedDriveError(data.name)
        existing = self.repo.get_by_name(data.name)
        if existing:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Configuration déjà existante pour {data.name}",
            )
        payload = data.model_dump(exclude={"credentials"})
        credentials = data.credentials or {}
        payload["credentials_encrypted"] = encrypt_credentials(credentials)
        return self.repo.add(DriveConfig(**payload))

    def update_config(self, drive_name: str, data: DriveConfigUpdate) -> DriveConfig:
        config = self._get_config(drive_name)
        patch = data.model_dump(exclude_unset=True)
        if "credentials" in patch:
            creds = patch.pop("credentials") or {}
            config.credentials_encrypted = encrypt_credentials(creds)
        for key, value in patch.items():
            setattr(config, key, value)
        return self.repo.save(config)

    def _get_config(self, drive_name: str) -> DriveConfig:
        config = self.repo.get_by_name(drive_name)
        if not config:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Config non trouvée")
        return config

    def _load_driver(self, drive_name: str) -> BaseDrive:
        if drive_name not in DRIVE_CLASSES:
            raise UnsupportedDriveError(drive_name)
        config = self._get_config(drive_name)
        credentials = decrypt_credentials(config.credentials_encrypted)
        return DRIVE_CLASSES[drive_name](credentials)

    def test_connection(self, drive_name: str) -> Dict[str, Any]:
        return self._load_driver(drive_name).test_connection()

    def search_product(self, drive_name: str, query: str) -> Dict[str, Any]:
        return {"results": self._load_driver(drive_name).search_product(query)}

    def add_to_cart(self, drive_name: str, items: List[CartItem]) -> Dict[str, Any]:
        return self._load_driver(drive_name).add_items_to_cart(items)
