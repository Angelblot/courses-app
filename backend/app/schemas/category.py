import re
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


_KEY_PATTERN = re.compile(r"^[a-z0-9_]+$")


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    label: str
    icon: str
    display_order: int = 0
    count: int = 0


class CategoryCreate(BaseModel):
    key: str = Field(min_length=1, max_length=50)
    label: str = Field(min_length=1, max_length=100)
    icon: str = Field(min_length=1, max_length=50)
    display_order: int = 0

    @field_validator("key")
    @classmethod
    def _validate_key(cls, v: str) -> str:
        v = v.strip().lower()
        if not _KEY_PATTERN.match(v):
            raise ValueError("key doit être en snake_case (a-z, 0-9, _)")
        return v

    @field_validator("label", "icon")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("champ requis")
        return v


class CategoryUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=100)
    icon: Optional[str] = Field(default=None, min_length=1, max_length=50)
    display_order: Optional[int] = None

    @field_validator("label", "icon")
    @classmethod
    def _strip(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("champ requis")
        return v
