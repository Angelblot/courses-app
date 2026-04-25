import pytest
from datetime import datetime, timedelta
from app.models.product import Product
from app.models.product_equivalent import ProductEquivalent
from app.services.search_strategy import build_search_query, SearchStrategyService


def test_build_search_query_common_with_brand():
    p = Product(name='Lait', brand='Candia', brand_type='common')
    assert build_search_query(p, 'carrefour') == 'Lait Candia'


def test_build_search_query_common_without_brand():
    p = Product(name='Pommes', brand_type='common')
    assert build_search_query(p, 'carrefour') == 'Pommes'


def test_build_search_query_store_brand_matching_drive():
    p = Product(name='Cola', brand='Coca', brand_type='store_brand', store_brand_affinity='carrefour')
    assert build_search_query(p, 'carrefour') == 'Cola Coca'


def test_build_search_query_store_brand_other_drive():
    p = Product(name='Cola', brand='Coca', brand_type='store_brand', store_brand_affinity='leclerc')
    assert build_search_query(p, 'carrefour') == 'Cola'


def test_build_search_query_generic():
    p = Product(name='Farine T65', brand='Bio', brand_type='generic')
    assert build_search_query(p, 'carrefour') == 'Farine T65'


def test_resolve_with_recent_equivalent(db_session):
    p = Product(name='Yaourt', brand='Danone', brand_type='common')
    db_session.add(p)
    db_session.commit()
    eq = ProductEquivalent(
        product_id=p.id,
        drive_name='carrefour',
        search_query='yaourt danone nature',
        last_confirmed_at=datetime.utcnow(),
    )
    db_session.add(eq)
    db_session.commit()

    svc = SearchStrategyService(db_session)
    query, confidence = svc.resolve(p, 'carrefour')
    assert query == 'yaourt danone nature'
    assert confidence == 'high'


def test_resolve_without_equivalent(db_session):
    p = Product(name='Pain', brand='Harrys', brand_type='common')
    db_session.add(p)
    db_session.commit()

    svc = SearchStrategyService(db_session)
    query, confidence = svc.resolve(p, 'leclerc')
    assert query == 'Pain Harrys'
    assert confidence == 'low'


def test_plan_generation_empty():
    svc = SearchStrategyService(None)
    assert svc.plan_generation([], 'carrefour') == []


def test_plan_generation_order(db_session):
    p1 = Product(name='A', brand='B1', brand_type='common')
    p2 = Product(name='C', brand='D1', brand_type='common')
    db_session.add_all([p1, p2])
    db_session.commit()

    svc = SearchStrategyService(db_session)
    plan = svc.plan_generation([p2.id, p1.id], 'carrefour')
    assert len(plan) == 2
    assert plan[0].product_id == p2.id
    assert plan[1].product_id == p1.id
    assert plan[0].confidence == 'low'
