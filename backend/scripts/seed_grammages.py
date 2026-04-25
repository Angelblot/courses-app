#!/usr/bin/env python3
"""Seed des grammages/volumes pour les 65 produits Carrefour.

Usage: python scripts/seed_grammages.py
"""

import json
import os
import sys
from pathlib import Path

# Ajouter le parent au PYTHONPATH pour pouvoir importer les models
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal, init_db
from app.models.product import Product


# Mapping: product_id -> {grammage_g, volume_ml} or None/null
GRAMMAGES = {
    # BOISSONS - pas de matching direct recette, mais on met des volumes réalistes
    1: None,       # Vin - pas de matching recette direct
    2: None,       # Bière - pas de matching recette direct
    3: None,       # Vin - pas de matching recette direct
    4: None,       # Bière sans alcool - pas de matching recette direct

    # CHARCUT.TRAITEUR
    5: {"grammage_g": 100},     # Pancetta - conditionnement ~100g
    6: None,                     # Œufs Plein Air - dénombrable (6 ou 12)

    # CONFORT DE LA MAISON - pas dans les recettes
    7: None,     # Recharge gaz
    8: None,     # Sacs réutilisables

    # DROGUERIE - pas dans les recettes
    9: None,     # Lingettes
    10: None,    # Essuie-tout
    11: None,    # Briquet

    # EPICERIE
    12: {"grammage_g": 150},    # Biscuits apéritifs
    13: {"grammage_g": 200},    # Petit Ecolier - boîte classique
    14: {"grammage_g": 500},    # Pâtes coudes rayés - paquet 500g
    15: {"grammage_g": 500},    # Pâtes spaghetti - paquet 500g
    16: {"grammage_g": 200},    # Cookies Granola
    17: {"grammage_g": 150},    # Bouillon déshydraté
    18: {"grammage_g": 50},     # Poivre Noir Grains - petit pot
    19: {"grammage_g": 200},    # Biscuits Chocolat
    20: {"grammage_g": 400},    # Pain Campagnard sans Gluten
    21: {"grammage_g": 200},    # Café capsules - boîte classique
    22: {"grammage_g": 500},    # Céréales Trésor
    23: {"grammage_g": 200},    # Graines de sésame
    24: {"grammage_g": 200},    # Cacahuètes Twinuts
    25: {"grammage_g": 180},    # Barres céréales - boîte
    26: {"volume_ml": 250},     # Sauce soja
    27: {"grammage_g": 150},    # Chips

    # FRUITS ET LEGUMES - au poids, pas de grammage fixe
    28: None,    # Pommes de terre vrac
    29: None,    # Avocat
    30: None,    # Oignons vrac

    # P.L.S. (Produits Laitiers et Sucrés)
    31: {"grammage_g": 200},    # Chorizo Doux
    32: {"grammage_g": 200},    # Muffins nature
    33: {"grammage_g": 200},    # Féta cubes - conditionnement 200g
    34: {"grammage_g": 200},    # Poitrine fumée - barquette ~200g
    35: {"grammage_g": 400},    # Pain de mie Harrys
    36: {"grammage_g": 200},    # Houmous
    37: {"grammage_g": 200},    # Allumettes nature - barquette 200g
    38: {"grammage_g": 200},    # Lardons fumés - barquette 200g
    39: {"grammage_g": 150},    # Parmigiano râpé - sachet 150g
    40: {"grammage_g": 200},    # Emmental râpé - sachet 200g
    41: {"grammage_g": 400},    # Filets de poulet - barquette ~400g
    42: {"grammage_g": 150},    # Parmigiano Reggiano Bio - 150g
    43: {"grammage_g": 200},    # Cheddar - bloc 200g
    44: {"volume_ml": 1000},    # Lait Demi-Ecrémé - bouteille 1L
    45: {"grammage_g": 150},    # Fromage Fouetté Madame Loïk
    46: {"grammage_g": 200},    # Gorgonzola - 200g
    47: {"grammage_g": 250},    # Pâtes Fraîches Tortellini - barquette 250g
    48: {"grammage_g": 230},    # Pâte feuilletée - rouleau 230g
    49: {"grammage_g": 500},    # Gnocchi à poêler - sachet 500g
    50: {"volume_ml": 750},     # Jus orange - bouteille 750ml
    51: {"grammage_g": 300},    # Pâtes à pizza - 300g
    52: {"grammage_g": 200},    # Houmous bio
    53: {"grammage_g": 250},    # Ravioles à poêler - barquette 250g
    54: {"grammage_g": 300},    # Fromage pour Tartiflette - portion
    55: {"volume_ml": 200},     # Crème Fraîche - 200ml

    # PARFUMERIE HYGIENE - pas dans les recettes
    56: None,    # Papier toilette
    57: None,    # Savon liquide
    58: None,    # Dentifrice
    59: None,    # Brosse à dents
    60: None,    # Déodorant
    61: None,    # Papier toilette
    62: None,    # Gel douche
    63: None,    # Mouchoirs
    64: None,    # Mouchoirs

    # ARTICLES INDISPONIBLES
    65: {"grammage_g": 300},    # Fromage pour Tartiflette Président
}


def seed_grammages():
    init_db()
    db = SessionLocal()
    try:
        updated = 0
        for product_id, values in GRAMMAGES.items():
            product = db.get(Product, product_id)
            if product is None:
                print(f"WARNING: Product {product_id} not found")
                continue
            if values is None:
                product.grammage_g = None
                product.volume_ml = None
            else:
                product.grammage_g = values.get("grammage_g")
                product.volume_ml = values.get("volume_ml")
            updated += 1
        db.commit()
        print(f"Grammages mis à jour pour {updated} produits")
    finally:
        db.close()


if __name__ == "__main__":
    seed_grammages()
