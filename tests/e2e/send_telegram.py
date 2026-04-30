#!/usr/bin/env python3
"""
Envoi de la vidéo/screenshots sur Telegram.

Deux modes :
  1. MEDIA: protocol (intégré Hermes) — le fichier est envoyé automatiquement
     en incluant MEDIA:/path/to/file dans la réponse
  2. Telegram Bot API direct — nécessite un TELEGRAM_BOT_TOKEN et
     TELEGRAM_CHAT_ID dans l'environnement

Usage:
  python3 tests/e2e/send_telegram.py videos    # envoie la vidéo
  python3 tests/e2e/send_telegram.py screenshots  # envoie tous les screenshots
  python3 tests/e2e/send_telegram.py all        # envoie tout
"""

import argparse
import os
import sys
from pathlib import Path

SCREENSHOTS_DIR = Path(__file__).resolve().parent.parent.parent / "screenshots"

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")


def send_via_bot(file_path: Path, caption: str = ""):
    """Envoie un fichier via l'API Telegram Bot."""
    if not BOT_TOKEN or not CHAT_ID:
        print("⚠️  TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID requis pour l'envoi direct")
        return False

    import requests

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendDocument"
    chat_id = CHAT_ID

    with open(file_path, "rb") as f:
        files = {"document": (file_path.name, f, _mime_type(file_path))}
        data = {"chat_id": chat_id, "caption": caption, "parse_mode": "HTML"}

        resp = requests.post(url, files=files, data=data, timeout=120)

    if resp.ok:
        print(f"  ✅ Envoyé: {file_path.name}")
        return True
    else:
        print(f"  ❌ Erreur API: {resp.status_code} {resp.text}")
        return False


def send_photo_via_bot(file_path: Path, caption: str = ""):
    """Envoie une image via l'API Telegram Bot."""
    if not BOT_TOKEN or not CHAT_ID:
        return False

    import requests

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"

    with open(file_path, "rb") as f:
        files = {"photo": (file_path.name, f, "image/png")}
        data = {"chat_id": CHAT_ID, "caption": caption, "parse_mode": "HTML"}

        resp = requests.post(url, files=files, data=data, timeout=120)

    if resp.ok:
        print(f"  ✅ Photo envoyée: {file_path.name}")
        return True
    else:
        print(f"  ❌ Erreur API photo: {resp.status_code}")
        return False


def _mime_type(path: Path) -> str:
    ext = path.suffix.lower()
    return {
        ".webm": "video/webm",
        ".mp4": "video/mp4",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
    }.get(ext, "application/octet-stream")


def main():
    parser = argparse.ArgumentParser(description="Envoi résultats tests sur Telegram")
    parser.add_argument(
        "mode",
        choices=["video", "screenshots", "all"],
        help="Quoi envoyer",
    )
    parser.add_argument(
        "--method",
        choices=["auto", "hermes", "bot"],
        default="auto",
        help="Méthode d'envoi (auto=hermes si MEDIA:, sinon bot)",
    )
    args = parser.parse_args()

    if not SCREENSHOTS_DIR.exists():
        print(f"❌ Dossier introuvable: {SCREENSHOTS_DIR}")
        sys.exit(1)

    video = SCREENSHOTS_DIR / "parcours.webm"
    video_mp4 = SCREENSHOTS_DIR / "parcours.mp4"
    screenshots = sorted(SCREENSHOTS_DIR.glob("*.png"))

    if args.mode in ("video", "all"):
        # Chercher la vidéo (webm ou mp4)
        vid = video if video.exists() else (video_mp4 if video_mp4.exists() else None)
        if vid:
            if args.method == "hermes" or (args.method == "auto" and "HERMES" in os.environ.get("AGENT_NAME", "").upper()):
                print(f"📤 MEDIA:{vid}")
            else:
                send_via_bot(vid, caption="🎬 <b>Parcours Courses App</b> — Test UI automatisé")
        else:
            print("⚠️  Aucune vidéo trouvée (cherché: parcours.webm ou .mp4)")

    if args.mode in ("screenshots", "all"):
        for i, ss in enumerate(screenshots):
            caption = f"📸 {ss.stem}"
            if args.method == "hermes" or (args.method == "auto" and "HERMES" in os.environ.get("AGENT_NAME", "").upper()):
                print(f"📤 MEDIA:{ss}")
            else:
                send_photo_via_bot(ss, caption=caption)

    print("✅ Envoi terminé")


if __name__ == "__main__":
    main()
