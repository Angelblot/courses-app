from typing import List

from sqlalchemy import select

from app.models.shopping_list import ShoppingList
from app.repositories.base import BaseRepository


class ShoppingListRepository(BaseRepository[ShoppingList]):
    model = ShoppingList

    def list(self) -> List[ShoppingList]:
        stmt = select(ShoppingList).order_by(ShoppingList.created_at.desc())
        return list(self.db.execute(stmt).scalars())
