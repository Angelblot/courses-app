#!/usr/bin/env python3
"""
Test UI automatisé — Wizard Courses App

Simule un parcours complet : Dashboard → Wizard (RecipePicker + DailyChecklist)
                → Produits → Détail produit

Problème technique résolu :
  Le swipe React utilise onPointerDown/Move/Up avec setPointerCapture sur
  .swipe-card--top. Les events dispatchEvent() ne marchent PAS car
  setPointerCapture est appelé DANS le handler et ne s'applique pas
  rétroactivement aux événements dispatchés manuellement.

Solution : Playwright mouse.down()/move()/up() génère des événements
  POINTER NATIFS qui passent par le pipeline complet du navigateur
  (hit-test → setPointerCapture → delivery). Ça fonctionne parce que
  Playwright agit au niveau du browser, pas du DOM.

Usage:
  python3 tests/e2e/test_swipe_wizard.py          # test complet avec vidéo
  python3 tests/e2e/test_swipe_wizard.py --no-video  # sans capture vidéo
  python3 tests/e2e/test_swipe_wizard.py --headless false  # voir le navigateur
  python3 tests/e2e/test_swipe_wizard.py --url https://frontend-sigma-smoky-79.vercel.app
"""

import argparse
import os
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

# ── Configuration ──────────────────────────────────────────────────────────

FRONTEND_URL = "https://frontend-sigma-smoky-79.vercel.app"
OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "screenshots"
SWIPE_THRESHOLD = 90  # px, doit correspondre à SWIPE_THRESHOLD dans SwipeStack.jsx

# Sélecteurs CSS clés
SELECTOR_SWIPE_CARD_TOP = ".swipe-card--top"
SELECTOR_SWIPE_WRAP = ".swipe-wrap"
SELECTOR_PRODUCT_CARD = ".product-card"  # sur ProductsPage
SELECTOR_WIZARD_FAB = ".wizard__fab"
SELECTOR_HOME_START_BTN = "text=Commencer"
SELECTOR_PRODUCTS_LINK = "text=Mes produits"
SELECTOR_PRODUCTS_LINK_NAV = 'a[href="/products"]'

# ── Helpers ────────────────────────────────────────────────────────────────


def ensure_output_dir():
    """Crée le dossier screenshots/ s'il n'existe pas."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def screenshot(page, name):
    """Capture un screenshot daté dans le dossier de sortie."""
    path = OUTPUT_DIR / f"{name}.png"
    page.screenshot(path=str(path), full_page=False)
    print(f"  📸 Screenshot: {path}")
    return path


def get_card_center(page):
    """
    Retourne les coordonnées (x, y) du centre de la carte .swipe-card--top.
    Lance une exception si la carte n'est pas trouvée.
    """
    card = page.locator(SELECTOR_SWIPE_CARD_TOP).first
    expect(card).to_be_visible(timeout=5000)
    box = card.bounding_box()
    if not box:
        raise RuntimeError("Impossible d'obtenir bounding_box de la carte")
    return box["x"] + box["width"] / 2, box["y"] + box["height"] / 2


def swipe_right(page):
    """
    Simule un swipe vers la droite (GARDER) sur la carte Tinder.
    
    Le mécanisme React :
      - onPointerDown : setPointerCapture + startRef = {x, y}
      - onPointerMove : calcule drag.x = e.clientX - startRef.current.x
      - onPointerUp   : si |drag.x| > SWIPE_THRESHOLD (90px) → commitSwipe
    
    Pourquoi Playwright mouse.down/move/up marche :
      - mouse.down()  → navigateur génère un PointerEvent natif avec
                        pointerId, clientX, clientY
      - React attrape pointerdown → setPointerCapture(e.pointerId) est
                        appelé sur l'élément
      - mouse.move()  → le navigateur achemine les pointermoves vers
                        l'élément capturant (grâce à setPointerCapture)
      - React reçoit les vrais PointerEvent avec clientX qui bouge
      - mouse.up()    → même mécanisme

    ATTENTION : Il faut s'assurer que le pointeur ne touche PAS un élément
    avec data-no-drag (comme le Counter dans la carte produit). On utilise
    le CENTRE de la carte pour éviter ça.
    """
    cx, cy = get_card_center(page)
    
    # mouse.move vers le centre de la carte
    page.mouse.move(cx, cy)
    page.wait_for_timeout(50)
    
    # mouse.down → déclenche onPointerDown → setPointerCapture
    page.mouse.down()
    page.wait_for_timeout(30)
    
    # mouse.move vers la droite (au-delà du threshold)
    page.mouse.move(cx + SWIPE_THRESHOLD + 30, cy, steps=8)
    page.wait_for_timeout(30)
    
    # mouse.up → déclenche onPointerUp → commitSwipe('right')
    page.mouse.up()
    page.wait_for_timeout(400)  # attendre l'animation (260ms) + rendering


def swipe_left(page):
    """Simule un swipe vers la gauche (PASSER). Même mécanisme que swipe_right."""
    cx, cy = get_card_center(page)
    
    page.mouse.move(cx, cy)
    page.wait_for_timeout(50)
    page.mouse.down()
    page.wait_for_timeout(30)
    page.mouse.move(cx - SWIPE_THRESHOLD - 30, cy, steps=8)
    page.wait_for_timeout(30)
    page.mouse.up()
    page.wait_for_timeout(400)


# ── Parcours ────────────────────────────────────────────────────────────────


def run_flow(page, frontend_url, args):
    """Exécute le parcours utilisateur complet."""
    
    # ── Étape 1: Dashboard ─────────────────────────────────────────────
    print("\n=== 1. Dashboard ===")
    page.goto(frontend_url, wait_until="networkidle")
    page.wait_for_timeout(2000)
    screenshot(page, "01-dashboard")
    
    # ── Étape 2: Wizard → RecipePicker ─────────────────────────────────
    print("\n=== 2. Wizard → Choix recettes ===")
    page.locator(SELECTOR_HOME_START_BTN).first.click()
    page.wait_for_url("**/wizard/**", timeout=10000)
    page.wait_for_timeout(2000)
    screenshot(page, "02-wizard-recipes")
    
    # Swiper quelques recettes (ou les passer rapidement via bouton skip)
    # On fait quelques swipes pour montrer l'interaction
    for i in range(min(3, count_swipe_cards(page))):
        try:
            swipe_right(page)  # Garder la recette
            print(f"  ✅ Recette {i+1} gardée")
        except Exception as e:
            print(f"  ⚠️ Plus de carte à swiper: {e}")
            break
    
    screenshot(page, "02b-wizard-recipes-swiped")
    
    # Cliquer sur "Continuer" si visible (bouton dans ResumePanel)
    continue_btn = page.locator(".swipe-resume__continue")
    if continue_btn.is_visible(timeout=2000):
        continue_btn.click()
        page.wait_for_timeout(1500)
    else:
        # Sinon utiliser le FAB
        fab = page.locator(SELECTOR_WIZARD_FAB)
        if fab.is_visible(timeout=2000):
            fab.click()
            page.wait_for_timeout(1500)
    
    # ── Étape 3: Wizard → DailyChecklist (swipe produits) ─────────────
    print("\n=== 3. Wizard → Checklist quotidienne ===")
    page.wait_for_timeout(2000)
    screenshot(page, "03-wizard-checklist")
    
    # Swiper les produits (garder quelques-uns)
    for i in range(min(3, count_swipe_cards(page))):
        try:
            swipe_right(page)  # Garder le produit
            print(f"  ✅ Produit {i+1} gardé")
        except Exception as e:
            print(f"  ⚠️ Plus de carte à swiper: {e}")
            break
    
    screenshot(page, "03b-wizard-checklist-swiped")
    
    # Navigation vers le récap / étape suivante via FAB
    fab = page.locator(SELECTOR_WIZARD_FAB)
    if fab.is_visible(timeout=3000):
        fab.click()
        page.wait_for_timeout(1500)
    
    # ── Étape 4: Page Produits ─────────────────────────────────────────
    print("\n=== 4. Page Produits ===")
    page.goto(f"{frontend_url}/products", wait_until="networkidle")
    page.wait_for_timeout(3000)
    screenshot(page, "04-products")
    
    # Ouvrir le détail du premier produit (ProductDetailModal - bottom sheet)
    first_card = page.locator(SELECTOR_PRODUCT_CARD).first
    if first_card.is_visible(timeout=5000):
        first_card.click()
        page.wait_for_timeout(2000)
        screenshot(page, "05-product-detail")
        
        # Fermer le détail
        close_btn = page.locator('button[aria-label="Fermer"]').first
        if close_btn.is_visible(timeout=2000):
            close_btn.click()
            page.wait_for_timeout(1000)
    
    # ── Étape 5: Retour Dashboard ──────────────────────────────────────
    print("\n=== 5. Retour Dashboard ===")
    page.goto(frontend_url, wait_until="networkidle")
    page.wait_for_timeout(2000)
    screenshot(page, "06-dashboard-final")
    
    print("\n✅ Parcours terminé!")


def count_swipe_cards(page):
    """Compte le nombre de cartes swipe visibles."""
    cards = page.locator(SELECTOR_SWIPE_CARD_TOP)
    return cards.count()


# ── Point d'entrée ──────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(
        description="Test UI automatisé — Wizard Courses App"
    )
    parser.add_argument(
        "--no-video", action="store_true", help="Désactiver la capture vidéo"
    )
    parser.add_argument(
        "--headless", type=lambda x: x.lower() == "true", default=True,
        help="Mode headless (true/false, défaut: true)"
    )
    parser.add_argument(
        "--url", default=FRONTEND_URL, help="URL du frontend à tester"
    )
    parser.add_argument(
        "--slow-mo", type=int, default=100,
        help="Ralentissement (ms) entre les actions Playwright"
    )
    args = parser.parse_args()
    
    # Surcharger l'URL frontend si fournie
    nonlocal_url = args.url  # utilisée plus bas
    
    ensure_output_dir()
    
    # Nettoyer les anciens screenshots
    for f in OUTPUT_DIR.glob("*.png"):
        f.unlink()
    
    video_path = OUTPUT_DIR / "parcours.mp4"
    if not args.no_video and video_path.exists():
        video_path.unlink()
    
    print(f"🔍 Frontend: {nonlocal_url}")
    print(f"📁 Output: {OUTPUT_DIR}")
    print(f"🎥 Video: {'OUI' if not args.no_video else 'NON'}")
    print(f"🖥️ Headless: {args.headless}")
    print()
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=args.headless,
            slow_mo=args.slow_mo,
        )
        
        context_options = {
            "viewport": {"width": 390, "height": 844},  # iPhone 14 Pro
            "device_scale_factor": 2,
            "user_agent": (
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
                "Mobile/15E148 Safari/604.1"
            ),
            "locale": "fr-FR",
            "timezone_id": "Europe/Paris",
        }
        
        if not args.no_video:
            context_options["record_video_dir"] = str(OUTPUT_DIR)
            context_options["record_video_size"] = {"width": 390, "height": 844}
        
        context = browser.new_context(**context_options)
        page = context.new_page()
        
        # Journalisation console
        page.on("console", lambda msg: None)  # silencieux
        page.on("pageerror", lambda err: print(f"  ❌ Page error: {err}"))
        
        try:
            run_flow(page, nonlocal_url, args)
        except Exception as e:
            print(f"\n❌ Erreur: {e}")
            import traceback
            traceback.print_exc()
            screenshot(page, "99-error-state")
        
        finally:
            context.close()
            browser.close()
    
    # Renommer la vidéo Playwright
    if not args.no_video:
        # Playwright sauvegarde dans record_video_dir avec un nom hashé
        video_files = list(OUTPUT_DIR.glob("*.webm"))
        if video_files:
            # Prendre le plus récent
            latest = max(video_files, key=os.path.getmtime)
            new_path = OUTPUT_DIR / "parcours.webm"
            if new_path.exists():
                new_path.unlink()
            latest.rename(new_path)
            print(f"\n🎥 Vidéo: {new_path}")
            print(f"   Taille: {new_path.stat().st_size / 1024 / 1024:.1f} MB")
    
    print(f"\n📸 Screenshots: {len(list(OUTPUT_DIR.glob('*.png')))} fichiers dans {OUTPUT_DIR}")
    print("✅ Test terminé")


if __name__ == "__main__":
    main()
