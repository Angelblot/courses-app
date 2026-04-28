"""Service de typologie automatique des produits.

Extrait un type semantique normalise depuis le nom d'un produit,
permettant de faire du matching intelligent entre ingredients
de recettes et produits de la liste.
"""

import re
from typing import Optional, List, Tuple

# Regles : (liste de mots-cles, type produit associe)
# L'ordre compte : les regles specifiques d'abord, les generiques apres
TYPE_RULES: List[Tuple[List[str], str]] = [
    # Charcuterie
    (["allumette", "lardon", "bacon", "poitrine"], "lardon"),
    (["chorizo", "saucisson", "saucisse", "rosette"], "charcuterie"),
    (["pancetta", "coppa", "prosciutto"], "charcuterie"),
    # Pates & riz
    (["spaghetti", "tortellini", "gnocchi", "tagliatelle", "penne", "fusilli"], "pate"),
    (["coude", "macaroni", "farfalle", "conchiglie"], "pate"),
    (["riz", "risotto", "arborio", "basmati", "jasmine", "thai"], "riz"),
    # Produits laitiers (SAUF lait et beurre, trop generiques)
    (["creme liquide", "creme fraiche"], "creme liquide"),
    (["parmesan", "parmigiano"], "parmesan"),
    (["mozzarella", "mozza", "burrata"], "mozzarella"),
    (["raviole", "ravioles"], "pate"),  # avant fromage (contient "fromage")
    (["emmental", "comte", "gruyere"], "fromage rape"),
    (["cheddar", "gorgonzola", "feta", "fromage"], "fromage"),
    (["yaourt", "yaourt grec", "skyr", "fromage blanc", "petit suisse"], "yaourt"),
    # Oeufs
    (["oeuf", "oeufs"], "oeuf"),
    # Legumes
    (["oignon", "oignons", "echalote", "cebette"], "oignon"),
    (["carotte"], "carotte"),
    (["pomme de terre", "pommes de terre", "patate"], "pomme de terre"),
    (["tomate", "tomates", "tomate cerise", "tomates cerises"], "tomate"),
    (["salade", "laitue", "mache", "roquette", "mesclun"], "salade"),
    ([" ail "], "ail"),  # avec espaces pour eviter "volaille"
    # Fruits
    (["avocat"], "avocat"),
    (["banane"], "banane"),
    (["pomme"], "pomme"),
    # Viandes
    (["filet de poulet", "blanc de poulet", "poulet", "cuisse de poulet"], "poulet"),
    (["boeuf", "entrecote", "faux-filet", "rumsteck"], "boeuf"),
    (["hache"], "viande hachee"),
    (["jambon blanc", "jambon fume", "jambon cru"], "jambon"),
    # Epicerie salee
    (["farine"], "farine"),
    (["sucre"], "sucre"),
    (["sel"], "sel"),
    (["poivre noir", "poivre blanc", "poivre"], "poivre"),
    (["huile d'olive"], "huile d'olive"),
    (["huile"], "huile"),
    (["vinaigre"], "vinaigre"),
    (["moutarde"], "moutarde"),
    (["bouillon"], "bouillon"),
    (["sauce soja", "soja"], "sauce soja"),
    (["ketchup", "mayonnaise"], "condiment"),
    # Epicerie sucree (AVANT lait/beurre)
    (["biscuit", "cookie", "granola", "petit beurre"], "biscuit"),
    (["cereale", "cereales", "tresor", "kellogg", "chocapic"], "cereale"),
    (["cafe", "capsule", "dolce gusto", "nescafe", "nespresso"], "cafe"),
    (["pain de mie", "pain", "baguette", "campagnard", "schar"], "pain"),
    (["chips", "cacahuete", "cacahuetes", "aperitif", "twinuts"], "aperitif"),
    (["houmous", "humous"], "houmous"),
    # Frais
    (["muffin", "muffins", "pate feuillettee", "pate a pizza", "pate"], "pate"),
    (["raviole", "ravioles"], "pate"),
    # Boissons
    ([" biere ", " ipa ", " tourtel "], "biere"),
    (["vin blanc", "vin rouge", "rose", "vin"], "vin"),
    (["jus"], "jus"),
    # Lait, beurre (EN DERNIER car trop generiques)
    (["beurre"], "beurre"),
    (["lait"], "lait"),
    # Hygiene
    (["gel douche", "shampooing", "shampoing", "savon"], "gel douche"),
    (["dentifrice"], "dentifrice"),
    (["deodorant"], "deodorant"),
    (["brosse a dent"], "brosse a dents"),
    ([" brosse "], "brosse a dents"),
    # Papier
    (["papier toilette", "pq"], "papier toilette"),
    (["mouchoir", "mouchoirs"], "mouchoirs"),
    (["essuie-tout", "essuie tout", "essuie main"], "essuie-tout"),
    # Droguerie
    (["lingette", "lingettes desinfectantes"], "lingettes"),
    (["briquet", "briquets", "bic"], "briquet"),
    (["recharge gaz", "gaz"], "recharge gaz"),
    (["sac", "sacs reutilisables", "sacs consignes"], "sac"),
]

# Mots a ignorer dans le nom (marques, descriptions, conditionnements)
STOPWORDS: set = {
    "carrefour", "classic'", "classic", "bio", "extra", "soft",
    "sensation", "eco", "planet", "essential", "simpl",
    "sans", "avec", "nature", "x", "lot", "pack", "maxi",
    "format", "economique", "familial",
    "g", "ml", "kg", "cl", "l", "frais", "fumes", "fume",
    "fumee", "fumees", "fines", "tranches", "tranche",
    "epais", "epaise", "legere",
    "confit", "confits", "rape", "fondant",
    "jaune", "blanc", "rouge", "noir",
    "nature", "pur",
    "hb", "hac",
}


def normalize_product_type(name: Optional[str]) -> Optional[str]:
    """Extrait le type semantique normalise d'un produit depuis son nom.

    Parcourt les regles de mapping mot-cle -> type. Si un mot-cle
    est present dans le nom (en minuscule), le type correspondant
    est retourne. Les mots-cles <= 3 chars sont verifies comme mots
    entiers via regex (evite les faux positifs comme "ail"/"volaille").

    Args:
        name: Nom du produit

    Returns:
        Type normalise ou None si non reconnu
    """
    if not name:
        return None

    name_lower = name.lower().strip()

    for keywords, product_type in TYPE_RULES:
        for keyword in keywords:
            stripped = keyword.strip()
            has_space_marker = keyword != stripped
            if has_space_marker or len(stripped) <= 3:
                # Mot-cle marque (espaces autour) ou court : match mot entier
                pattern = r'(^|\s)' + re.escape(stripped) + r'($|\s)'
                if re.search(pattern, name_lower):
                    return product_type
            elif ' ' in stripped:
                # Multi-mot : word boundary leading uniquement
                pattern = r'(^|\s)' + re.escape(stripped)
                if re.search(pattern, name_lower):
                    return product_type
            else:
                if stripped in name_lower:
                    return product_type

    # Fallback : premier mot significatif (longueur > 3, pas un stopword)
    words = [
        w for w in name_lower.split()
        if w not in STOPWORDS and len(w) > 3
    ]
    return words[0] if words else None
