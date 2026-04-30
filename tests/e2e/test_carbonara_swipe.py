#!/usr/bin/env python3
"""
Script court : ouvre le frontend Vercel, lance le wizard, swipe Carbonara à droite.

Pourquoi mouse.down/move/up + steps marche alors que dispatchEvent échoue :
  SwipeStack.jsx appelle setPointerCapture(e.pointerId) dans onPointerDown.
  - dispatchEvent : pointerId invalide → capture échoue → pointermove suivants
    ne sont plus routés vers la carte → React voit drag.x = 0 → pas de swipe.
  - Playwright mouse.* : passe par CDP Input.dispatchMouseEvent → events natifs
    isTrusted, pointerId valide, capture OK, drag fluide.
  - steps=15 : génère 15 pointermove intermédiaires entre down et up. Sans ça,
    un seul pointermove sauterait par-dessus le seuil de 90 px sans permettre
    à React de mettre à jour drag.x progressivement (et l'animation visuelle
    serait absente sur les screenshots).

Usage :
    cd ~/courses-app && python3 tests/e2e/test_carbonara_swipe.py
"""

from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = "https://frontend-sigma-smoky-79.vercel.app"
OUT = Path(__file__).resolve().parent.parent.parent / "screenshots" / "carbonara"
SWIPE_THRESHOLD = 90  # doit matcher SWIPE_THRESHOLD dans SwipeStack.jsx


def shot(page, name):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.png"
    page.screenshot(path=str(path))
    print(f"  screenshot -> {path}")


def swipe_top_card_right(page, overshoot=200):
    """Swipe la carte .swipe-card--top vers la droite au-delà du seuil."""
    card = page.locator(".swipe-card--top").first
    expect(card).to_be_visible(timeout=8000)
    box = card.bounding_box()
    cx = box["x"] + box["width"] / 2
    cy = box["y"] + box["height"] / 2

    page.mouse.move(cx, cy)
    page.mouse.down()
    page.wait_for_timeout(40)
    page.mouse.move(cx + SWIPE_THRESHOLD + overshoot, cy, steps=15)
    page.wait_for_timeout(40)
    page.mouse.up()
    page.wait_for_timeout(400)  # animation d'exit (260 ms) + re-render


def top_card_title(page):
    """Lit le titre de la recette en haut de pile (.recipe-sw__title)."""
    title = page.locator(".swipe-card--top .recipe-sw__title").first
    return title.inner_text(timeout=3000).strip()


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, slow_mo=80)
        context = browser.new_context(
            viewport={"width": 390, "height": 844},  # iPhone 14 Pro
            device_scale_factor=2,
            locale="fr-FR",
        )
        page = context.new_page()
        page.on("pageerror", lambda e: print(f"  page error: {e}"))

        # 1. Ouvrir le frontend
        print("\n[1] Ouverture du dashboard")
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(1500)
        shot(page, "01-dashboard")

        # 2. Lancer le wizard via le bouton de la nav-bar du bas
        print("\n[2] Clic sur le bouton Wizard (aria-label='Lancer le wizard')")
        page.locator("button[aria-label='Lancer le wizard']").click()
        page.wait_for_url("**/wizard/**", timeout=8000)
        page.wait_for_selector(".swipe-card--top", timeout=8000)
        page.wait_for_timeout(800)
        shot(page, "02-wizard-recipes")

        # 3. Trouver Carbonara
        print("\n[3] Recherche de Carbonara au-dessus de la pile")
        max_pass = 8
        for i in range(max_pass):
            try:
                title = top_card_title(page)
            except Exception:
                title = "(carte introuvable)"
            print(f"  carte courante : {title!r}")
            if "carbonara" in title.lower():
                print("  -> Carbonara trouvée !")
                break
            print("  -> swipe LEFT (passer)")
            card = page.locator(".swipe-card--top").first
            box = card.bounding_box()
            cx = box["x"] + box["width"] / 2
            cy = box["y"] + box["height"] / 2
            page.mouse.move(cx, cy)
            page.mouse.down()
            page.wait_for_timeout(40)
            page.mouse.move(cx - SWIPE_THRESHOLD - 200, cy, steps=15)
            page.wait_for_timeout(40)
            page.mouse.up()
            page.wait_for_timeout(400)
        else:
            print(f"  Carbonara non trouvée après {max_pass} swipes")
            shot(page, "99-carbonara-not-found")
            context.close()
            browser.close()
            return

        shot(page, "03-carbonara-on-top")

        # 4. Swipe droit pour sélectionner
        print("\n[4] Swipe RIGHT sur Carbonara (sélectionner)")
        swipe_top_card_right(page)
        shot(page, "04-after-swipe-right")

        # 5. Vérifier
        try:
            new_title = top_card_title(page)
            print(f"\n[5] Nouvelle carte : {new_title!r}")
        except Exception:
            print("\n[5] Plus de carte (pile terminée)")
        shot(page, "05-final-state")

        context.close()
        browser.close()
        print(f"\nTerminé. Screenshots dans : {OUT}")


if __name__ == "__main__":
    run()
