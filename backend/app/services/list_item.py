from fastapi import HTTPException, status

from app.models.list_item import ListItem
from app.repositories.list_item import ListItemRepository
from app.repositories.shopping_list import ShoppingListRepository
from app.schemas.list_item import ListItemCreate, ListItemUpdate


class ListItemService:
    def __init__(self, repo: ListItemRepository, list_repo: ShoppingListRepository):
        self.repo = repo
        self.list_repo = list_repo

    def _ensure_list(self, list_id: int) -> None:
        if not self.list_repo.get(list_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Liste non trouvée")

    def add(self, list_id: int, data: ListItemCreate) -> ListItem:
        self._ensure_list(list_id)
        return self.repo.add(ListItem(**data.model_dump(), shopping_list_id=list_id))

    def add_raw(self, **fields) -> ListItem:
        return self.repo.add(ListItem(**fields))

    def update(self, list_id: int, item_id: int, data: ListItemUpdate) -> ListItem:
        self._ensure_list(list_id)
        item = self.repo.get_for_list(list_id, item_id)
        if not item:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Item non trouvé")
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(item, key, value)
        return self.repo.save(item)

    def delete(self, list_id: int, item_id: int) -> None:
        self._ensure_list(list_id)
        item = self.repo.get_for_list(list_id, item_id)
        if not item:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Item non trouvé")
        self.repo.delete(item)
