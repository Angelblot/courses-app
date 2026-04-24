#!/usr/bin/env python3
"""Importe une commande Carrefour Drive depuis un fichier markdown."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import Base, engine, SessionLocal
from app.models.drive_config import DriveConfig
from app.models.product import Product
from app.models.product_drive import ProductDrive
from app.models.purchase_line import PurchaseLine
from datetime import date


DRIVE_NAME = "carrefour"
DRIVE_DISPLAY = "Carrefour Drive"
PURCHASE_DATE = date(2025, 12, 8)


def parse_markdown(filepath: str):
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    products = []
    current_category = None

    for line in lines:
        line = line.strip()
        if line.startswith("##"):
            current_category = line.lstrip("#").strip()
            continue
        if not line.startswith("|"):
            continue

        parts = [p.strip() for p in line.split("|")[1:-1]]

        if len(parts) < 9:
            continue
        if parts[0] in ("EAN13", "---") or set(parts[0]) <= set("-"):
            continue

        ean13 = parts[0]
        if not ean13.isdigit() or len(ean13) != 13:
            continue

        libelle = parts[1]
        qte = parts[2]
        qte_liv = parts[3]
        tva = parts[4]
        pu_ht = parts[5].replace(",", ".") if parts[5] else None
        pu_ttc = parts[6].replace(",", ".") if parts[6] else None
        remise = parts[7].replace(",", ".") if parts[7] else None
        montant = parts[8].replace(",", ".") if parts[8] else None

        words = libelle.split()
        brand = None
        for i in range(len(words) - 1, -1, -1):
            word = words[i]
            if word.isupper() and len(word) > 1:
                brand = word
                break

        if brand:
            name = libelle.rsplit(brand, 1)[0].strip()
            for suffix in ["AOP", "A.O.P", "IGP", "Bio", "UHT"]:
                if name.endswith(suffix):
                    name = name[: -len(suffix)].strip()
                    break
        else:
            name = libelle

        products.append(
            {
                "ean13": ean13,
                "name": name,
                "full_name": libelle,
                "brand": brand,
                "category": current_category,
                "quantity_ordered": int(qte) if qte.isdigit() else 0,
                "quantity_delivered": int(qte_liv) if qte_liv.isdigit() else 0,
                "vat_rate": float(tva) if tva else None,
                "price_ht": float(pu_ht) if pu_ht else None,
                "price_ttc": float(pu_ttc) if pu_ttc else None,
                "discount": float(remise) if remise else None,
                "total_ttc": float(montant) if montant else None,
            }
        )

    return products


def get_or_create_drive(db) -> DriveConfig:
    drive = db.query(DriveConfig).filter_by(name=DRIVE_NAME).first()
    if drive is None:
        drive = DriveConfig(name=DRIVE_NAME, display_name=DRIVE_DISPLAY, enabled=True)
        db.add(drive)
        db.commit()
        db.refresh(drive)
    return drive


def import_products(products: list[dict]):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    imported = 0
    skipped = 0
    linked = 0

    try:
        drive = get_or_create_drive(db)

        for p in products:
            existing = db.query(Product).filter(Product.ean13 == p["ean13"]).first()
            if existing is not None:
                skipped += 1
                product = existing
            else:
                product = Product(
                    ean13=p["ean13"],
                    name=p["name"],
                    brand=p["brand"],
                    category=p["category"],
                    default_quantity=p["quantity_ordered"] or 1,
                    unit="unité",
                    favorite=False,
                    notes=p["full_name"],
                    price_ht=p["price_ht"],
                    price_ttc=p["price_ttc"],
                    vat_rate=p["vat_rate"],
                )
                db.add(product)
                db.flush()
                imported += 1

            already = (
                db.query(ProductDrive)
                .filter_by(product_id=product.id, drive_config_id=drive.id)
                .first()
            )
            if already is None:
                db.add(ProductDrive(product_id=product.id, drive_config_id=drive.id))
                linked += 1

            # Historique d'achat
            line = PurchaseLine(
                product_id=product.id,
                drive_config_id=drive.id,
                quantity_ordered=p["quantity_ordered"],
                quantity_delivered=p["quantity_delivered"],
                unit_price_ht=p["price_ht"],
                unit_price_ttc=p["price_ttc"],
                vat_rate=p["vat_rate"],
                discount_ttc=p["discount"],
                total_ttc=p["total_ttc"],
                purchase_date=PURCHASE_DATE,
            )
            db.add(line)

        db.commit()
        print(f"{imported} produits importés")
        print(f"{skipped} produits déjà existants (ignorés)")
        print(f"{linked} liens drive carrefour créés")
        print(f"{len(products)} lignes d'achat historisées pour le {PURCHASE_DATE}")
    finally:
        db.close()


if __name__ == "__main__":
    filepath = sys.argv[1] if len(sys.argv) > 1 else "/tmp/carrefour_order_20251208.md"
    print(f"Parsing {filepath}...")
    products = parse_markdown(filepath)
    print(f"{len(products)} produits trouvés")
    print(f"Catégories: {sorted(set(p['category'] for p in products))}")
    import_products(products)
