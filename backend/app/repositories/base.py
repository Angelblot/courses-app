from typing import Generic, Optional, Type, TypeVar

from sqlalchemy.orm import Session

from app.core.database import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    model: Type[ModelT]

    def __init__(self, db: Session):
        self.db = db

    def get(self, obj_id: int) -> Optional[ModelT]:
        return self.db.get(self.model, obj_id)

    def add(self, instance: ModelT) -> ModelT:
        self.db.add(instance)
        self.db.commit()
        self.db.refresh(instance)
        return instance

    def delete(self, instance: ModelT) -> None:
        self.db.delete(instance)
        self.db.commit()

    def save(self, instance: ModelT) -> ModelT:
        self.db.commit()
        self.db.refresh(instance)
        return instance
