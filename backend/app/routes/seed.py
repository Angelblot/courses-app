import json
import os
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.product import Product
from app.models.drive_config import DriveConfig
from app.models.product_drive import ProductDrive
from app.models.purchase_line import PurchaseLine

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/seed")
def seed_database(db: Session = Depends(get_db)):
    seed_path = os.path.join(os.path.dirname(__file__), "..", "..", "seed_data.json")
    if not os.path.exists(seed_path):
        return {"status": "error", "detail": "seed_data.json not found"}

    with open(seed_path, "r") as f:
        data = json.load(f)

    counts = {}

    # Seed drive_configs
    if db.query(DriveConfig).count() == 0:
        for row in data.get("drive_configs", []):
            db.add(DriveConfig(**row))
        counts["drive_configs"] = len(data.get("drive_configs", []))

    # Seed products
    if db.query(Product).count() == 0:
        for row in data.get("products", []):
            db.add(Product(**row))
        counts["products"] = len(data.get("products", []))

    # Seed product_drives
    if db.query(ProductDrive).count() == 0:
        for row in data.get("product_drives", []):
            db.add(ProductDrive(**row))
        counts["product_drives"] = len(data.get("product_drives", []))

    # Seed purchase_lines
    if db.query(PurchaseLine).count() == 0:
        for row in data.get("purchase_lines", []):
            db.add(PurchaseLine(**row))
        counts["purchase_lines"] = len(data.get("purchase_lines", []))

    db.commit()
    return {"status": "ok", "seeded": counts}


@router.get("/health")
def health_check():
    return {"status": "ok"}
