from typing import List

from fastapi import APIRouter, Depends, status

from app.routes.deps import drive_service
from app.schemas.cart import CartItem
from app.schemas.drive_config import DriveConfigCreate, DriveConfigOut, DriveConfigUpdate
from app.services.drive import DriveService

router = APIRouter()


@router.get("/configs", response_model=List[DriveConfigOut])
def get_configs(svc: DriveService = Depends(drive_service)):
    return svc.list_configs()


@router.post(
    "/configs",
    response_model=DriveConfigOut,
    status_code=status.HTTP_201_CREATED,
)
def create_config(
    payload: DriveConfigCreate,
    svc: DriveService = Depends(drive_service),
):
    return svc.create_config(payload)


@router.put("/configs/{drive_name}", response_model=DriveConfigOut)
def update_config(
    drive_name: str,
    payload: DriveConfigUpdate,
    svc: DriveService = Depends(drive_service),
):
    return svc.update_config(drive_name, payload)


@router.post("/{drive_name}/test-connection")
def test_connection(drive_name: str, svc: DriveService = Depends(drive_service)):
    return svc.test_connection(drive_name)


@router.post("/{drive_name}/search")
def search_product(
    drive_name: str,
    query: str,
    svc: DriveService = Depends(drive_service),
):
    return svc.search_product(drive_name, query)


@router.post("/{drive_name}/add-to-cart")
def add_to_cart(
    drive_name: str,
    items: List[CartItem],
    svc: DriveService = Depends(drive_service),
):
    return svc.add_to_cart(drive_name, items)
