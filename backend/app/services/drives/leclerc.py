import time
from typing import Any, Dict, List

from app.services.drives._browser import open_browser
from app.services.drives.base import BaseDrive


class LeclercDrive(BaseDrive):
    name = "leclerc"
    BASE_URL = "https://www.e-leclerc.com"

    def test_connection(self) -> Dict[str, Any]:
        try:
            with open_browser(headless=True) as page:
                page.goto(self.BASE_URL, wait_until="domcontentloaded", timeout=30000)
                if page.query_selector("input[type='search']") or "leclerc" in page.content().lower():
                    return {"success": True, "message": "Site E.Leclerc accessible"}
                return {"success": False, "message": "Impossible d'accéder au site"}
        except Exception as exc:
            return {"success": False, "message": str(exc)}

    def search_product(self, query: str) -> List[Dict[str, Any]]:
        try:
            with open_browser(headless=True) as page:
                page.goto(self.BASE_URL, wait_until="domcontentloaded", timeout=30000)
                time.sleep(2)
                search_input = page.query_selector(
                    "input[type='search'], input[placeholder*='recherche'], #search"
                )
                if not search_input:
                    return []
                search_input.fill(query)
                search_input.press("Enter")
                time.sleep(4)

                results: List[Dict[str, Any]] = []
                for card in page.query_selector_all(
                    ".product-item, .prd-item, [data-testid='product']"
                )[:5]:
                    try:
                        title_el = card.query_selector(".title, .product-title, h2, h3")
                        price_el = card.query_selector(".price, .prix, .product-price")
                        link_el = card.query_selector("a")

                        title = title_el.inner_text().strip() if title_el else ""
                        price = price_el.inner_text().strip() if price_el else ""
                        link = link_el.get_attribute("href") if link_el else ""
                        if not title:
                            continue
                        results.append({
                            "title": title,
                            "price": price,
                            "url": f"{self.BASE_URL}{link}" if link.startswith("/") else link,
                            "drive": self.name,
                        })
                    except Exception:
                        continue
                return results
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
                for item in items:
                    product_name = _item_attr(item, "product_name")
                    try:
                        page.goto(self.BASE_URL, wait_until="domcontentloaded", timeout=30000)
                        time.sleep(2)

                        search_input = page.query_selector(
                            "input[type='search'], input[placeholder*='recherche']"
                        )
                        if search_input:
                            search_input.fill(product_name)
                            search_input.press("Enter")
                            time.sleep(4)

                        first = page.query_selector(".product-item a, .prd-item a")
                        if not first:
                            result["items_failed"].append(product_name)
                            continue

                        first.click()
                        time.sleep(3)
                        add_btn = page.query_selector(
                            "button:has-text('Ajouter'), .add-to-cart, [data-testid='add-to-cart']"
                        )
                        if add_btn:
                            add_btn.click()
                            time.sleep(2)
                            result["items_added"] += 1
                        else:
                            result["items_failed"].append(product_name)
                    except Exception as exc:
                        result["items_failed"].append(product_name)
                        result["errors"].append(str(exc))

                page.goto(f"{self.BASE_URL}/panier", wait_until="domcontentloaded", timeout=30000)
                result["cart_url"] = page.url
                result["success"] = result["items_added"] > 0
        except Exception as exc:
            result["errors"].append(str(exc))

        return result


def _item_attr(item: Any, key: str, default: Any = "") -> Any:
    if hasattr(item, key):
        return getattr(item, key)
    if isinstance(item, dict):
        return item.get(key, default)
    return default
