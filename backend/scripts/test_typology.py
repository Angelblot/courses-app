#!/usr/bin/env python3
"""Tests pour le normaliseur de types produit."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.product_typology import normalize_product_type

tests = [
    # Charcuterie
    ("Lardons fumes conservation sans nitrite", "lardon"),
    ("Allumettes nature sans nitrite CARREFOUR", "lardon"),
    ("Bacon tranches fines", "lardon"),
    ("Poitrine fumees fines tranches HERTA", "lardon"),
    ("Chorizo Doux SIMPL", "charcuterie"),
    # Pates
    ("Pates spaghetti n5 BARILLA", "pate"),
    ("Pates Fraiches Tortellini Jambon Cru", "pate"),
    ("Pates coudes rayes PANZANI", "pate"),
    ("Pates Fraiches Gnocchi A Poeler", "pate"),
    ("Ravioles A Poeler Fromage Frais/Basilic", "pate"),
    # Produits laitiers
    ("Creme Fraiche Epaisse Legere 15%", "creme liquide"),
    ("Oeufs Plein Air", "oeuf"),
    ("Parmigiano Reggiano rape AOP", "parmesan"),
    ("Emmental rape fondant CARREFOUR", "fromage rape"),
    ("Beurre doux", "beurre"),
    ("Lait Demi-Ecreme UHT Bio", "lait"),
    # Viandes
    ("Filets de poulet jaune CARREFOUR", "poulet"),
    ("Blanc de poulet", "poulet"),
    # Epicerie
    ("Biscuits Chocolat au Lait DELICHOC", "biscuit"),
    ("Cookies aux gros eclats de chocolat Granola", "biscuit"),
    ("Cafe Capsules Lungo Intensite 6", "cafe"),
    ("Pain Campagnard sans Gluten SCHAR", "pain"),
    ("Pain de mie American sandwich", "pain"),
    ("Sauce soja salee SUZI WAN", "sauce soja"),
    ("Bouillon Deshydrate de Volaille Bio", "bouillon"),
    ("Poivre Noir Grains DUCROS", "poivre"),
    ("Huile d'olive vierge extra", "huile d'olive"),
    ("Cereales Tresor Chocolat au Lait", "cereale"),
    # Boissons
    ("Biere Aromatisee Jus de Mangue Sans Alcool", "biere"),
    ("Biere Blonde Stonewall Inn IPA 4.6%", "biere"),
    ("Vin Blanc Pays d'Oc Chardonnay", "vin"),
    ("Jus orange sans pulpe INNOCENT", "jus"),
    # Hygiene
    ("Dentifrice Anti-tartre SIGNAL", "dentifrice"),
    ("Gel douche Hypoallergenique Peaux Normales", "gel douche"),
    ("Deodorant bille Anti-transpirant", "deodorant"),
    ("Brosse a dents classique medium", "brosse a dents"),
    ("Papier Toilette Confort Doux", "papier toilette"),
    ("Mouchoirs CARREFOUR ECO PLANET", "mouchoirs"),
    ("Essuie-tout Ultra Absorption Blanc CARREFOUR", "essuie-tout"),
    # Droguerie
    ("Lingettes Desinfectantes CARREFOUR", "lingettes"),
    ("Briquet Maxi Colores BIC", "briquet"),
    ("Sacs reutilisables consignes Drive", "sac"),
    # Fruits & legumes
    ("Avocat", "avocat"),
    ("Oignons jaunes vrac", "oignon"),
    ("Pommes de terre de conservation vrac", "pomme de terre"),
    # Autre
    ("Houmous bio L'ATELIER BLINI", "houmous"),
    ("Muffins nature CARREFOUR SENSATION", "pate"),
    ("Pate feuilletée CARREFOUR CLASSIC'", "pate"),
    # Fallback (premier mot significatif)
    ("Briquet Maxi Colores BIC", "briquet"),
]

passed = 0
failed = 0

for name, expected in tests:
    result = normalize_product_type(name)
    if result == expected:
        print(f"OK  {name[:45]:45s} -> {result}")
        passed += 1
    else:
        print(f"FAIL {name[:45]:45s} -> {str(result):20s} (expected: {expected})")
        failed += 1

print(f"\n{'='*60}")
print(f"Resultat : {passed}/{len(tests)} passed, {failed} failed")
sys.exit(0 if failed == 0 else 1)
