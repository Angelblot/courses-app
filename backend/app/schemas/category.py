from pydantic import BaseModel


class CategoryOut(BaseModel):
    key: str
    label: str
    icon: str
    count: int = 0
