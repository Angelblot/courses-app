from abc import ABC, abstractmethod
from typing import Any, Dict, List


class BaseDrive(ABC):
    name: str = ""

    def __init__(self, credentials: Dict[str, str]):
        self.credentials = credentials or {}
        self.email = self.credentials.get("email")
        self.password = self.credentials.get("password")
        self.store = self.credentials.get("store")

    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        ...

    @abstractmethod
    def search_product(self, query: str) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def add_items_to_cart(self, items: List[Any]) -> Dict[str, Any]:
        ...

    @staticmethod
    def _normalize_name(name: str) -> str:
        return name.lower().strip()
