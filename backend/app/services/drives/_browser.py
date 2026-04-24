"""Lazy playwright helper — keeps scraping logic import-safe in tests."""

from contextlib import contextmanager
from typing import Optional

from app.core.config import get_settings


@contextmanager
def open_browser(headless: Optional[bool] = None):
    from playwright.sync_api import sync_playwright  # lazy import

    settings = get_settings()
    effective_headless = settings.playwright_headless if headless is None else headless

    p = sync_playwright().start()
    browser = None
    try:
        browser = p.chromium.launch(headless=effective_headless, args=["--no-sandbox"])
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()
        yield page
    finally:
        if browser is not None:
            browser.close()
        p.stop()
