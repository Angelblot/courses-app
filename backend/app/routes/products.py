from typing import Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, status

from app.core.database import SessionLocal
from app.routes.deps import product_service
from app.schemas.equivalent import ProductEquivalentCreate, ProductEquivalentOut
from app.schemas.product import GrammageUpdate, ProductCreate, ProductOut, ProductUpdate
from app.schemas.purchase_line import ProductPriceHistoryOut
from app.services.enrich_ean import enrich_all_products
from app.services.product import ProductService

router = APIRouter()


@router.get("/grammage", response_model=List[dict])
def list_grammages(svc: ProductService = Depends(product_service)):
    """Renvoie la liste des grammages/volumes de tous les produits."""
    products = svc.list()
    return [
        {
            "id": p.id,
            "name": p.name,
            "grammage_g": p.grammage_g,
            "volume_ml": p.volume_ml,
            "unit": p.unit,
        }
        for p in products
    ]


@router.get("/", response_model=List[ProductOut])
def list_products(
    favorite_only: bool = False,
    drive: Optional[str] = None,
    svc: ProductService = Depends(product_service),
):
    return svc.list(favorite_only=favorite_only, drive=drive)


@router.post("/", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, svc: ProductService = Depends(product_service)):
    return svc.create(payload)


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, svc: ProductService = Depends(product_service)):
    return svc.get(product_id)


@router.get("/{product_id}/price-history", response_model=ProductPriceHistoryOut)
def get_product_price_history(
    product_id: int, svc: ProductService = Depends(product_service)
):
    return svc.get_price_history(product_id)


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    svc: ProductService = Depends(product_service),
):
    return svc.update(product_id, payload)


@router.delete("/{product_id}")
def delete_product(product_id: int, svc: ProductService = Depends(product_service)):
    svc.delete(product_id)
    return {"ok": True}


@router.get("/{product_id}/equivalents", response_model=List[ProductEquivalentOut])
def get_product_equivalents(
    product_id: int, svc: ProductService = Depends(product_service)
):
    return svc.get_equivalents(product_id)


@router.put("/{product_id}/equivalents", response_model=ProductEquivalentOut)
def set_product_equivalent(
    product_id: int,
    payload: ProductEquivalentCreate,
    svc: ProductService = Depends(product_service),
):
    return svc.set_equivalent(product_id, **payload.model_dump())


@router.post("/enrich-ean")
def enrich_products_ean(background_tasks: BackgroundTasks) -> Dict:
    """Enrichit les grammages/volumes des produits via Open Food Facts.

    Parcourt tous les produits qui ont un EAN13 mais ni grammage_g ni
    volume_ml renseignés, interroge l'API Open Food Facts pour chaque,
    et met à jour la base de données.

    L'enrichissement s'exécute en arrière-plan. La réponse retourne
    immédiatement un accusé de réception.
    """
    background_tasks.add_task(enrich_all_products, SessionLocal)
    return {"status": "started", "message": "L'enrichissement des grammages via Open Food Facts a été lancé en arrière-plan."}


@router.patch("/{product_id}/grammage", response_model=ProductOut)
def patch_product_grammage(
    product_id: int,
    payload: GrammageUpdate,
    svc: ProductService = Depends(product_service),
):
    """Met à jour le grammage/volume d'un produit.

    Permet à l'utilisateur de renseigner manuellement le poids ou le volume
    d'un produit quand l'enrichissement automatique (OFF) n'a rien trouvé.
    """
    product = svc.get(product_id)
    patch = payload.model_dump(exclude_unset=True)
    for key, value in patch.items():
        setattr(product, key, value)
    svc.repo.save(product)
    return svc._enrich(product)
