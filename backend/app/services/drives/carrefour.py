import time
from typing import Any, Dict, List

from app.services.drives._browser import open_browser
from app.services.drives.base import BaseDrive


class CarrefourDrive(BaseDrive):
    name = "carrefour"
    BASE_URL = "https://www.carrefour.fr"

    CARD_SELECTORS = "[data-testid='product-card'], .product-card, .ds-product-card"
    TITLE_SELECTORS = ".product-title, [data-testid='product-title'], h2, h3"
    PRICE_SELECTORS = ".product-price, [data-testid='product-price'], .price"

    def test_connection(self) -> Dict[str, Any]:
        try:
            with open_browser(headless=True) as page:
                page.goto(f"{self.BASE_URL}/login", wait_until="domcontentloaded", timeout=30000)
                if page.query_selector("input[type='email']") or "connexion" in page.content().lower():
                    return {"success": True, "message": "Page de connexion accessible"}
                return {"success": False, "message": "Impossible d'accéder à la page de connexion"}
        except Exception as exc:
            return {"success": False, "message": str(exc)}

    def search_product(self, query: str) -> List[Dict[str, Any]]:
        try:
            with open_browser(headless=True) as page:
                page.goto(
                    f"{self.BASE_URL}/s?q={query.replace(' ', '+')}",
                    wait_until="domcontentloaded",
                    timeout=30000,
                )
                time.sleep(3)
                return self._parse_cards(page)
        except Exception:
            return []

    def add_items_to_cart(self, items: List[Any]) -> Dict[str, Any]:
        result = {
            "success": False,
            "drive": self.name,
            "items_added": 0,
            "items_failed": [],
            "errors": [],
            "cart_url": None,
        }

        try:
            with open_browser(headless=False) as page:
                page.goto(f"{self.BASE_URL}/login", wait_until="domcontentloaded", timeout=30000)
                time.sleep(2)
                page.fill("input[type='email']", self.email or "")
                page.fill("input[type='password']", self.password or "")
                page.click("button[type='submit']")
                time.sleep(5)

                if "mon-compte" not in page.url and "compte" not in page.content().lower():
                    result["errors"].append("Échec de la connexion")
                    return result

                for item in items:
                    product_name = _item_attr(item, "product_name")
                    quantity = int(_item_attr(item, "quantity", 1) or 1)
                    try:
                        matches = self._search_in_session(page, product_name)
                        if not matches:
                            result["items_failed"].append(product_name)
                            continue

                        page.goto(matches[0]["url"], wait_until="domcontentloaded", timeout=30000)
                        time.sleep(2)
                        add_btn = page.query_selector(
                            "button[data-testid='add-to-cart'], .add-to-cart, button:has-text('Ajouter')"
                        )
                        if not add_btn:
                            result["items_failed"].append(product_name)
                            continue

                        add_btn.click()
                        time.sleep(2)
                        for _ in range(max(0, quantity - 1)):
                            plus_btn = page.query_selector(
                                "button[data-testid='quantity-plus'], .quantity-plus"
                            )
                            if plus_btn:
                                plus_btn.click()
                                time.sleep(0.5)
                        result["items_added"] += 1
                    except Exception as exc:
                        result["items_failed"].append(product_name)
                        result["errors"].append(str(exc))

                page.goto(f"{self.BASE_URL}/panier", wait_until="domcontentloaded", timeout=30000)
                result["cart_url"] = page.url
                result["success"] = result["items_added"] > 0
        except Exception as exc:
            result["errors"].append(str(exc))

        return result

    def _search_in_session(self, page, query: str) -> List[Dict[str, Any]]:
        try:
            page.goto(
                f"{self.BASE_URL}/s?q={query.replace(' ', '+')}",
                wait_until="domcontentloaded",
                timeout=30000,
            )
            time.sleep(3)
            return self._parse_cards(page, include_drive=False)
        except Exception:
            return []

    def _parse_cards(self, page, include_drive: bool = True) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for card in page.query_selector_all(self.CARD_SELECTORS)[:5]:
            try:
                title_el = card.query_selector(self.TITLE_SELECTORS)
                price_el = card.query_selector(self.PRICE_SELECTORS)
                link_el = card.query_selector("a")

                title = title_el.inner_text().strip() if title_el else ""
                price = price_el.inner_text().strip() if price_el else ""
                link = link_el.get_attribute("href") if link_el else ""

                if not title:
                    continue
                entry = {
                    "title": title,
                    "price": price,
                    "url": f"{self.BASE_URL}{link}" if link.startswith("/") else link,
                }
                if include_drive:
                    entry["drive"] = self.name
                out.append(entry)
            except Exception:
                continue
        return out


def _item_attr(item: Any, key: str, default: Any = "") -> Any:
    if hasattr(item, key):
        return getattr(item, key)
    if isinstance(item, dict):
        return item.get(key, default)
    return default
