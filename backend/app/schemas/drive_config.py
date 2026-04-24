from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict


class DriveConfigBase(BaseModel):
    name: str
    display_name: Optional[str] = None
    enabled: bool = True
    default_store: Optional[str] = None


class DriveConfigCreate(DriveConfigBase):
    credentials: Optional[Dict[str, Any]] = None


class DriveConfigUpdate(BaseModel):
    display_name: Optional[str] = None
    enabled: Optional[bool] = None
    default_store: Optional[str] = None
    credentials: Optional[Dict[str, Any]] = None


class DriveConfigOut(DriveConfigBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
