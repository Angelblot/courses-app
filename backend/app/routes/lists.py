from typing import List

from fastapi import APIRouter, Depends, status

from app.routes.deps import list_item_service, shopping_list_service
from app.schemas.list_item import ListItemCreate, ListItemOut, ListItemUpdate
from app.schemas.shopping_list import ShoppingListCreate, ShoppingListOut
from app.services.list_item import ListItemService
from app.services.shopping_list import ShoppingListService

router = APIRouter()


@router.get("/", response_model=List[ShoppingListOut])
def list_lists(svc: ShoppingListService = Depends(shopping_list_service)):
    return svc.list()


@router.post("/", response_model=ShoppingListOut, status_code=status.HTTP_201_CREATED)
def create_list(
    payload: ShoppingListCreate,
    svc: ShoppingListService = Depends(shopping_list_service),
):
    return svc.create(payload)


@router.get("/{list_id}", response_model=ShoppingListOut)
def get_list(list_id: int, svc: ShoppingListService = Depends(shopping_list_service)):
    return svc.get(list_id)


@router.delete("/{list_id}")
def delete_list(list_id: int, svc: ShoppingListService = Depends(shopping_list_service)):
    svc.delete(list_id)
    return {"ok": True}


@router.post("/{list_id}/items", response_model=ListItemOut, status_code=status.HTTP_201_CREATED)
def add_item(
    list_id: int,
    payload: ListItemCreate,
    svc: ListItemService = Depends(list_item_service),
):
    return svc.add(list_id, payload)


@router.put("/{list_id}/items/{item_id}", response_model=ListItemOut)
def update_item(
    list_id: int,
    item_id: int,
    payload: ListItemUpdate,
    svc: ListItemService = Depends(list_item_service),
):
    return svc.update(list_id, item_id, payload)


@router.delete("/{list_id}/items/{item_id}")
def delete_item(
    list_id: int,
    item_id: int,
    svc: ListItemService = Depends(list_item_service),
):
    svc.delete(list_id, item_id)
    return {"ok": True}


@router.post("/{list_id}/generate-from-favorites")
def generate_from_favorites(
    list_id: int,
    svc: ShoppingListService = Depends(shopping_list_service),
):
    return {"added": svc.generate_from_favorites(list_id)}
