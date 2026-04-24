from app.services.drives.base import BaseDrive
from app.services.drives.carrefour import CarrefourDrive
from app.services.drives.leclerc import LeclercDrive

DRIVE_CLASSES: dict[str, type[BaseDrive]] = {
    "carrefour": CarrefourDrive,
    "leclerc": LeclercDrive,
}

__all__ = ["BaseDrive", "CarrefourDrive", "LeclercDrive", "DRIVE_CLASSES"]
