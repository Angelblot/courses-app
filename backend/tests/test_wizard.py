import pytest


def test_wizard_plan_empty(client):
    res = client.get('/api/wizard/plan')
    assert res.status_code == 200
    assert res.json() == []


def test_wizard_plan_with_favorites(client):
    client.post('/api/products/', json={'name': 'Lait', 'brand': 'Candia', 'favorite': True})
    client.post('/api/products/', json={'name': 'Pain', 'brand': 'Harrys', 'favorite': True})
    client.post('/api/products/', json={'name': 'Sel', 'favorite': False})

    res = client.get('/api/wizard/plan')
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    names = [item['name'] for item in data]
    assert 'Lait' in names
    assert 'Pain' in names


def test_wizard_plan_drive_param(client):
    client.post('/api/products/', json={'name': 'Fromage', 'brand': 'President', 'brand_type': 'common', 'favorite': True})

    res = client.get('/api/wizard/plan?drive=leclerc')
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]['search_query'] == 'Fromage President'
    assert data[0]['confidence'] == 'low'
    assert data[0]['brand_type'] == 'common'
