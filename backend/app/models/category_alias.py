from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CategoryAlias(Base):
    __tablename__ = "category_aliases"

    label_raw: Mapped[str] = mapped_column(String(150), primary_key=True)
    key_canonical: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
