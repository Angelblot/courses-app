import json
import os
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.product import Product
from app.models.drive_config import DriveConfig
from app.models.product_drive import ProductDrive
from app.models.purchase_line import PurchaseLine

router = APIRouter(prefix="/admin", tags=["admin"])


def _parse_dates(row: dict, model_cls) -> dict:
    """Convertit les chaînes ISO en datetime pour les colonnes DateTime."""
    from sqlalchemy import inspect as sa_inspect
    from sqlalchemy.types import DateTime

    mapper = sa_inspect(model_cls)
    result = dict(row)
    for col in mapper.columns:
        if isinstance(col.type, DateTime) and col.name in result:
            val = result[col.name]
            if isinstance(val, str):
                # gère '2026-04-23 18:21:42.261352' ou '2026-04-23 18:21:42'
                fmt = "%Y-%m-%d %H:%M:%S.%f" if "." in val else "%Y-%m-%d %H:%M:%S"
                result[col.name] = datetime.strptime(val, fmt)
    return result


@router.post("/seed")
def seed_database(db: Session = Depends(get_db)):
    seed_path = str(Path(__file__).resolve().parent.parent.parent / "seed_data.json")
    if not os.path.exists(seed_path):
        return {"status": "error", "detail": f"seed_data.json not found at {seed_path}"}

    with open(seed_path, "r") as f:
        data = json.load(f)

    counts = {}

    # Seed drive_configs
    if db.query(DriveConfig).count() == 0:
        for row in data.get("drive_configs", []):
            db.add(DriveConfig(**_parse_dates(row, DriveConfig)))
        counts["drive_configs"] = len(data.get("drive_configs", []))

    # Seed products
    if db.query(Product).count() == 0:
        for row in data.get("products", []):
            db.add(Product(**_parse_dates(row, Product)))
        counts["products"] = len(data.get("products", []))

    # Seed product_drives
    if db.query(ProductDrive).count() == 0:
        for row in data.get("product_drives", []):
            db.add(ProductDrive(**_parse_dates(row, ProductDrive)))
        counts["product_drives"] = len(data.get("product_drives", []))

    # Seed purchase_lines
    if db.query(PurchaseLine).count() == 0:
        for row in data.get("purchase_lines", []):
            db.add(PurchaseLine(**_parse_dates(row, PurchaseLine)))
        counts["purchase_lines"] = len(data.get("purchase_lines", []))

    db.commit()
    return {"status": "ok", "seeded": counts}


@router.get("/health")
def health_check():
    return {"status": "ok"}
