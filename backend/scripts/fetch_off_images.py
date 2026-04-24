"""Fetch product images from Open Food Facts and update the local SQLite DB.

Usage:
    python scripts/fetch_off_images.py [--db path/to/app.db] [--limit N] [--force]
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
import time
from pathlib import Path

import httpx

OFF_URL = "https://world.openfoodfacts.org/api/v0/product/{ean}.json"
USER_AGENT = "courses-app/1.0 (local integration; contact: local)"
IMAGE_KEYS = ("image_url", "image_front_url", "image_small_url", "image_front_small_url")


def extract_image(payload: dict) -> str | None:
    if not isinstance(payload, dict):
        return None
    if payload.get("status") != 1:
        return None
    product = payload.get("product") or {}
    for key in IMAGE_KEYS:
        value = product.get(key)
        if isinstance(value, str) and value.startswith("http"):
            return value
    images = product.get("selected_images") or {}
    front = images.get("front") or {}
    displayed = front.get("display") or {}
    for lang in ("fr", "en"):
        val = displayed.get(lang)
        if isinstance(val, str) and val.startswith("http"):
            return val
    return None


def fetch_one(client: httpx.Client, ean: str) -> tuple[str | None, str]:
    """Return (image_url, status) where status is one of: found, missing, error."""
    try:
        r = client.get(OFF_URL.format(ean=ean), timeout=15.0)
    except httpx.HTTPError as exc:
        return None, f"error:{type(exc).__name__}"
    if r.status_code == 429:
        return None, "rate_limited"
    if r.status_code != 200:
        return None, f"http_{r.status_code}"
    try:
        data = r.json()
    except ValueError:
        return None, "invalid_json"
    img = extract_image(data)
    if img:
        return img, "found"
    return None, "missing"


def run(db_path: Path, limit: int | None, force: bool, sleep: float) -> int:
    if not db_path.exists():
        print(f"ERREUR: base introuvable: {db_path}", file=sys.stderr)
        return 2

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cols = [r[1] for r in cur.execute("PRAGMA table_info(products)").fetchall()]
    if "image_url" not in cols:
        print("ERREUR: colonne image_url manquante (ALTER TABLE requis)", file=sys.stderr)
        conn.close()
        return 3

    where = "WHERE ean13 IS NOT NULL AND TRIM(ean13) != ''"
    if not force:
        where += " AND (image_url IS NULL OR image_url = '')"
    query = f"SELECT id, ean13, name FROM products {where} ORDER BY id"
    if limit:
        query += f" LIMIT {int(limit)}"
    rows = cur.execute(query).fetchall()
    total = len(rows)
    print(f"Produits a traiter: {total}")

    found = 0
    missing = 0
    errors = 0

    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    with httpx.Client(headers=headers, follow_redirects=True) as client:
        for i, row in enumerate(rows, 1):
            ean = (row["ean13"] or "").strip()
            name = row["name"]
            if not ean:
                continue
            img, status = fetch_one(client, ean)
            tag = "OK  " if status == "found" else ("--  " if status == "missing" else "ERR ")
            print(f"  [{i:>3}/{total}] {tag} {ean:<13} {name[:40]:<40} {status}")
            if status == "found" and img:
                cur.execute(
                    "UPDATE products SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (img, row["id"]),
                )
                conn.commit()
                found += 1
            elif status == "missing":
                missing += 1
            else:
                errors += 1
                if status == "rate_limited":
                    print("    -> rate limited, pause 10s")
                    time.sleep(10)
            time.sleep(sleep)

    conn.close()

    print("")
    print("=== Resume ===")
    print(f"  trouves : {found}")
    print(f"  manquants: {missing}")
    print(f"  erreurs : {errors}")
    print(f"  total   : {total}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch OFF product images")
    default_db = Path(__file__).resolve().parent.parent / "app.db"
    parser.add_argument("--db", type=Path, default=default_db)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--force", action="store_true", help="re-fetch even if image_url set")
    parser.add_argument("--sleep", type=float, default=0.15)
    args = parser.parse_args()
    return run(args.db, args.limit, args.force, args.sleep)


if __name__ == "__main__":
    sys.exit(main())
