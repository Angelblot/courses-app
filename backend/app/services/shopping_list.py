from typing import List

from fastapi import HTTPException, status

from app.models.shopping_list import ShoppingList
from app.repositories.product import ProductRepository
from app.repositories.shopping_list import ShoppingListRepository
from app.schemas.shopping_list import ShoppingListCreate
from app.services.list_item import ListItemService


class ShoppingListService:
    def __init__(
        self,
        repo: ShoppingListRepository,
        product_repo: ProductRepository,
        items: ListItemService,
    ):
        self.repo = repo
        self.product_repo = product_repo
        self.items = items

    def list(self) -> List[ShoppingList]:
        return self.repo.list()

    def get(self, list_id: int) -> ShoppingList:
        lst = self.repo.get(list_id)
        if not lst:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Liste non trouvée")
        return lst

    def create(self, data: ShoppingListCreate) -> ShoppingList:
        return self.repo.add(ShoppingList(name=data.name))

    def delete(self, list_id: int) -> None:
        self.repo.delete(self.get(list_id))

    def generate_from_favorites(self, list_id: int) -> int:
        lst = self.get(list_id)
        added = 0
        for fav in self.product_repo.list_favorites():
            if not self.items.repo.exists_in_list(lst.id, fav.id):
                self.items.add_raw(
                    shopping_list_id=lst.id,
                    product_id=fav.id,
                    quantity=fav.default_quantity,
                )
                added += 1
        return added
