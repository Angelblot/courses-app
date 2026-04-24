from typing import Optional

from sqlalchemy import select

from app.models.list_item import ListItem
from app.repositories.base import BaseRepository


class ListItemRepository(BaseRepository[ListItem]):
    model = ListItem

    def get_for_list(self, list_id: int, item_id: int) -> Optional[ListItem]:
        stmt = select(ListItem).where(
            ListItem.id == item_id,
            ListItem.shopping_list_id == list_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def exists_in_list(self, list_id: int, product_id: int) -> bool:
        stmt = select(ListItem.id).where(
            ListItem.shopping_list_id == list_id,
            ListItem.product_id == product_id,
        )
        return self.db.execute(stmt).first() is not None
