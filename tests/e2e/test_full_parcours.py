#!/usr/bin/env python3
"""
Parcours complet capturé en screenshots sur le frontend Vercel :

  1. Dashboard
  2. Wizard étape 1 (recettes) — swipe left jusqu'à Carbonara
  3. Swipe right Carbonara (gardée)
  4. Swipe right recette suivante (gardée aussi)
  5. Wizard étape 2 (inventaire) si présente
  6. Passage à l'étape 3 si bouton Suivant disponible
  7. Retour dashboard via Escape
  8. Page Produits
  9. Détail produit + scroll

Notes techniques :
  - SwipeStack utilise setPointerCapture, donc on passe par mouse.down/move/up
    natifs (CDP) plutôt que dispatchEvent — voir test_carbonara_swipe.py.
  - steps=15 sur mouse.move : laisse React mettre à jour drag.x progressivement
    et l'animation visuelle apparaît sur les screenshots intermédiaires.
  - Pas de wait_for_url('/wizard/') : le wizard est rendu dans la même URL
    (modal/overlay), pas une route dédiée.

Usage :
    cd ~/courses-app && python3 tests/e2e/test_full_parcours.py
"""

from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = "https://frontend-sigma-smoky-79.vercel.app"
OUT = Path(__file__).resolve().parent.parent.parent / "screenshots" / "parcours"
SWIPE_THRESHOLD = 90  # doit matcher SWIPE_THRESHOLD dans SwipeStack.jsx
SWIPE_OVERSHOOT = 200  # cx ± (THRESHOLD + OVERSHOOT) = cx ± 290

# Compteur global pour la numérotation séquentielle des screenshots.
_step = 0


def shot(page, label):
    """Sauvegarde un screenshot avec un préfixe numérique séquentiel."""
    global _step
    _step += 1
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{_step:02d}-{label}.png"
    page.screenshot(path=str(path))
    print(f"  screenshot -> {path.name}")


def top_card_box(page):
    """Bounding box de la carte du dessus de pile."""
    card = page.locator(".swipe-card--top").first
    expect(card).to_be_visible(timeout=8000)
    return card.bounding_box()


def top_card_title(page):
    """Titre de la recette en haut de pile."""
    title = page.locator(".swipe-card--top .recipe-sw__title").first
    return title.inner_text(timeout=3000).strip()


def swipe_top_card(page, direction):
    """Swipe la carte du dessus à gauche ('left') ou à droite ('right')."""
    box = top_card_box(page)
    cx = box["x"] + box["width"] / 2
    cy = box["y"] + box["height"] / 2

    target_x = cx + (SWIPE_THRESHOLD + SWIPE_OVERSHOOT) * (1 if direction == "right" else -1)

    page.mouse.move(cx, cy)
    page.mouse.down()
    page.wait_for_timeout(40)
    page.mouse.move(target_x, cy, steps=15)
    page.wait_for_timeout(40)
    page.mouse.up()
    page.wait_for_timeout(400)  # exit animation (260 ms) + re-render


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

        # ----------------------------------------------------------------
        # 1. Dashboard
        # ----------------------------------------------------------------
        print("\n[1] Ouverture du dashboard")
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(1500)
        shot(page, "dashboard")

        # ----------------------------------------------------------------
        # 2. Lancer le wizard
        # ----------------------------------------------------------------
        print("\n[2] Clic sur le bouton Wizard")
        page.locator("button[aria-label='Lancer le wizard']").click()
        page.wait_for_selector(".swipe-card--top", timeout=8000)
        page.wait_for_timeout(800)
        shot(page, "wizard-recipes")

        # ----------------------------------------------------------------
        # 3. Swipe LEFT jusqu'à Carbonara
        # ----------------------------------------------------------------
        print("\n[3] Recherche de Carbonara (swipe LEFT pour passer)")
        max_pass = 10
        found = False
        for i in range(max_pass):
            try:
                title = top_card_title(page)
            except Exception:
                title = "(carte introuvable)"
            print(f"  carte {i + 1} : {title!r}")
            if "carbonara" in title.lower():
                print("  -> Carbonara trouvée !")
                found = True
                break
            swipe_top_card(page, "left")

        if not found:
            print(f"  Carbonara non trouvée après {max_pass} swipes — abandon")
            shot(page, "carbonara-not-found")
            context.close()
            browser.close()
            return

        shot(page, "carbonara-on-top")

        # ----------------------------------------------------------------
        # 4. Swipe RIGHT pour garder Carbonara
        # ----------------------------------------------------------------
        print("\n[4] Swipe RIGHT (garder Carbonara)")
        swipe_top_card(page, "right")
        shot(page, "after-keep-carbonara")

        # ----------------------------------------------------------------
        # 5. Swipe RIGHT sur la recette suivante
        # ----------------------------------------------------------------
        print("\n[5] Swipe RIGHT (garder recette suivante)")
        try:
            next_title = top_card_title(page)
            print(f"  recette suivante : {next_title!r}")
            swipe_top_card(page, "right")
            shot(page, "after-keep-next")
        except Exception:
            print("  pas de carte suivante visible")
            shot(page, "no-next-card")

        # ----------------------------------------------------------------
        # 6. Étape 2 (inventaire) si présente
        # ----------------------------------------------------------------
        print("\n[6] Capture étape 2 (inventaire) si visible")
        page.wait_for_timeout(1000)
        shot(page, "wizard-step2")

        # ----------------------------------------------------------------
        # 7. Bouton Suivant -> étape 3
        # ----------------------------------------------------------------
        print("\n[7] Tentative de passage à l'étape 3")
        next_btn = page.get_by_role("button", name="Suivant")
        if next_btn.count() > 0 and next_btn.first.is_visible():
            try:
                next_btn.first.click()
                page.wait_for_timeout(1000)
                shot(page, "wizard-step3")
            except Exception as e:
                print(f"  clic Suivant échoué : {e}")
                shot(page, "wizard-step3-failed")
        else:
            print("  bouton Suivant absent — on reste sur l'étape courante")
            shot(page, "wizard-no-next")

        # ----------------------------------------------------------------
        # 8. Retour au dashboard via Escape
        # ----------------------------------------------------------------
        print("\n[8] Retour dashboard via Escape")
        page.keyboard.press("Escape")
        page.wait_for_timeout(800)
        shot(page, "dashboard-back")

        # ----------------------------------------------------------------
        # 9. Page Produits
        # ----------------------------------------------------------------
        print("\n[9] Navigation vers la page Produits")
        # On essaye d'abord par lien direct, sinon par bouton de la nav-bar.
        try:
            page.goto(f"{URL}/products", wait_until="networkidle")
        except Exception:
            products_btn = page.get_by_role("link", name="Produits")
            if products_btn.count() == 0:
                products_btn = page.get_by_role("button", name="Produits")
            products_btn.first.click()
        page.wait_for_timeout(1200)
        shot(page, "products-list")

        # ----------------------------------------------------------------
        # 10. Détail d'un produit
        # ----------------------------------------------------------------
        print("\n[10] Clic sur le premier produit")
        product_card = page.locator(".product-card, [data-testid='product-card']").first
        if product_card.count() == 0:
            # Fallback : premier article cliquable de la grille produits.
            product_card = page.locator("main a, main button").first
        try:
            product_card.click()
            page.wait_for_timeout(1000)
            shot(page, "product-detail")
        except Exception as e:
            print(f"  clic produit échoué : {e}")
            shot(page, "product-detail-failed")

        # ----------------------------------------------------------------
        # 11. Scroll du détail
        # ----------------------------------------------------------------
        print("\n[11] Scroll du détail produit")
        page.mouse.wheel(0, 600)
        page.wait_for_timeout(500)
        shot(page, "product-detail-scrolled")
        page.mouse.wheel(0, 600)
        page.wait_for_timeout(500)
        shot(page, "product-detail-scrolled-2")

        # ----------------------------------------------------------------
        # 12. Fermer le détail
        # ----------------------------------------------------------------
        print("\n[12] Fermeture du détail (Escape)")
        page.keyboard.press("Escape")
        page.wait_for_timeout(600)
        # Remonter en haut de la liste pour repartir d'un état connu.
        page.mouse.wheel(0, -5000)
        page.wait_for_timeout(400)
        shot(page, "products-list-back")

        # ----------------------------------------------------------------
        # 13. Recherche d'un produit utilisé dans une recette
        # ----------------------------------------------------------------
        # On cible des produits dont la typologie correspond à un ingrédient
        # de Carbonara (lardon -> Allumettes, œuf -> Œufs, pâtes, crème).
        print("\n[13] Recherche d'un produit lié à une recette")
        targets = ["allumettes", "lardon", "œufs", "oeufs", "pâtes", "pates", "crème", "creme"]
        target_card = None
        target_label = None
        max_scrolls = 25
        for i in range(max_scrolls):
            titles = page.locator(".item__title")
            count = titles.count()
            for idx in range(count):
                try:
                    text = titles.nth(idx).inner_text(timeout=500).strip()
                except Exception:
                    continue
                low = text.lower()
                if any(t in low for t in targets):
                    target_card = titles.nth(idx)
                    target_label = text
                    print(f"  trouvé : {text!r} (scroll #{i})")
                    break
            if target_card is not None:
                break
            page.mouse.wheel(0, 600)
            page.wait_for_timeout(250)

        if target_card is None:
            print("  aucun produit cible trouvé après scroll")
            shot(page, "recipe-product-not-found")
        else:
            # ------------------------------------------------------------
            # 14. Clic sur ce produit et screenshot du détail
            # ------------------------------------------------------------
            print(f"\n[14] Clic sur {target_label!r} et capture du détail")
            try:
                target_card.scroll_into_view_if_needed(timeout=2000)
                page.wait_for_timeout(300)
                target_card.click()
                page.wait_for_timeout(1000)
                shot(page, "recipe-product-detail")
                # Petit scroll pour révéler la zone "Utilisé dans les recettes".
                page.mouse.wheel(0, 500)
                page.wait_for_timeout(500)
                shot(page, "recipe-product-detail-scrolled")
            except Exception as e:
                print(f"  clic produit recette échoué : {e}")
                shot(page, "recipe-product-detail-failed")

        context.close()
        browser.close()
        print(f"\nTerminé. Screenshots dans : {OUT}")


if __name__ == "__main__":
    run()
