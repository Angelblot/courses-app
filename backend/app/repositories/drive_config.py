from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select

from app.models.drive_config import DriveConfig
from app.repositories.base import BaseRepository


class DriveConfigRepository(BaseRepository[DriveConfig]):
    model = DriveConfig

    def list(self) -> List[DriveConfig]:
        return list(self.db.execute(select(DriveConfig)).scalars())

    def get_by_name(self, name: str) -> Optional[DriveConfig]:
        stmt = select(DriveConfig).where(DriveConfig.name == name)
        return self.db.execute(stmt).scalar_one_or_none()
