"""Service de résolution d'ingrédients en produits du catalogue.

Implémente l'Approche A : matching flou + scoring pondéré.
Permet de substituer un ingrédient de recette par le produit le plus pertinent
disponible dans le catalogue, avec ajustement des quantités (NEAREST_PACK).
"""

import math
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.product import Product

# ---------------------------------------------------------------------------
# 1. Table de synonymes (hardcodée, extensible)
# ---------------------------------------------------------------------------

INGREDIENT_SYNONYMS: Dict[str, List[str]] = {
    "lardons": ["allumettes", "lardons", "bacon", "poitrine fumée"],
    "lardons fumés": ["allumettes fumées", "lardons nature", "poitrine fumée", "bacon"],
    "allumettes": ["lardons", "bacon en dés", "poitrine"],
    "allumettes fumées": ["lardons fumés", "allumettes nature", "bacon"],
    "steak haché": ["steak haché", "viande hachée", "bœuf haché", "boeuf haché"],
    "crème": ["crème", "crème fraîche", "crème liquide", "crème épaisse"],
    "crème fraîche": ["crème entière", "crème liquide", "crème épaisse"],
    "parmesan": ["parmigiano reggiano", "grana padano", "fromage râpé italien", "fromage râpé"],
    "filet de poulet": ["blanc de poulet", "escalope de poulet", "poulet jaune"],
    "pâtes": ["spaghetti", "tagliatelle", "penne", "pâtes longues", "pâtes courtes"],
    "oignon": ["oignon jaune", "oignon blanc", "oignon rouge", "échalote"],
    "lait": ["lait demi-écrémé", "lait entier", "lait écrémé"],
    "beurre": ["beurre doux", "beurre demi-sel", "beurre salé"],
    "fromage": ["fromage râpé", "cheddar", "gruyère", "comté", "emmental"],
    "poulet": ["blanc de poulet", "filet de poulet", "poulet entier", "cuisse de poulet"],
}


def get_synonyms(ingredient_name: str) -> List[str]:
    """Renvoie la liste des synonymes pour un ingrédient donné.

    Cherche d'abord un match exact dans la table, puis un match partiel.
    """
    name_lower = ingredient_name.strip().lower()
    # Match exact
    if name_lower in INGREDIENT_SYNONYMS:
        return [s for s in INGREDIENT_SYNONYMS[name_lower] if s != name_lower]
    # Match partiel : clé contenue dans le nom
    for key, synonyms in INGREDIENT_SYNONYMS.items():
        if key in name_lower or name_lower in key:
            return [s for s in synonyms if s != name_lower]
    return []


# ---------------------------------------------------------------------------
# 2. Tokenisation et similarité de nom
# ---------------------------------------------------------------------------

_STOPWORDS = {"de", "du", "des", "le", "la", "les", "au", "aux", "et",
              "à", "sans", "avec", "sur", "nature", "fumé", "fumée",
              "fumés", "fumées", "bio", "frais", "fraîche", "frais",
              "entier", "entière", "légère", "léger", "allégé",
              "confit", "confits", "rôti", "rôtie", "râpé", "râpée"}


def tokenize(text: str) -> List[str]:
    """Tokenise un texte : minuscules, split sur non-alpha, stopwords retirés."""
    tokens = re.findall(r"[a-zA-Zéèêëàâäîïôöùûüç]+", text.lower())
    return [t for t in tokens if t not in _STOPWORDS and len(t) > 1]


def name_similarity(name_a: str, name_b: str) -> float:
    """Calcule la similarité entre deux noms (tokenisation + substring).

    Retourne un score entre 0.0 et 1.0.
    Combine :
    - Ratio de tokens communs (poids 0.7)
    - Substring containment (poids 0.3)
    """
    tokens_a = set(tokenize(name_a))
    tokens_b = set(tokenize(name_b))

    if not tokens_a or not tokens_b:
        return 0.0

    # Token overlap (Jaccard)
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    token_score = len(intersection) / len(union) if union else 0.0

    # Substring containment
    a_lower = name_a.lower()
    b_lower = name_b.lower()
    if len(a_lower) >= 3 and len(b_lower) >= 3:
        if a_lower in b_lower or b_lower in a_lower:
            substring_score = min(len(a_lower), len(b_lower)) / max(len(a_lower), len(b_lower))
        else:
            substring_score = 0.0
    else:
        substring_score = 0.0

    return 0.7 * token_score + 0.3 * substring_score


# ---------------------------------------------------------------------------
# 3. Scoring pondéré
# ---------------------------------------------------------------------------

SCORE_WEIGHTS = {
    "name_similarity": 0.35,
    "store_brand": 0.20,
    "user_preference": 0.15,
    "purchase_history": 0.10,
    "synonym_bonus": 0.10,
    "grammage_penalty": -0.10,
}


def _get_grammage_g(product: Product) -> Optional[int]:
    """Renvoie le grammage pertinent (g ou ml converti) d'un produit."""
    if product.grammage_g:
        return product.grammage_g
    if product.volume_ml:
        return product.volume_ml
    return None


def _compute_grammage_penalty(product: Product, need_g: float) -> float:
    """Calcule la pénalité d'écart grammage (entre 0 et 1).

    Plus le produit est loin du besoin en grammage, plus la pénalité est élevée.
    """
    pack_g = _get_grammage_g(product)
    if pack_g is None or need_g <= 0:
        return 0.0
    # Ratio besoin / grammage
    ratio = need_g / pack_g
    if ratio <= 1.3:
        # Tolérance : pas de pénalité
        return 0.0
    if ratio <= 2.0:
        return 0.3
    if ratio <= 3.0:
        return 0.6
    return 1.0


def _synonym_bonus(ingredient_name: str, product_name: str) -> float:
    """Bonus si le produit est un synonyme connu de l'ingrédient."""
    name_lower = ingredient_name.strip().lower()
    prod_lower = product_name.strip().lower()

    # Vérifie si le nom du produit contient un synonyme
    for key, synonyms in INGREDIENT_SYNONYMS.items():
        if key in name_lower or name_lower in key:
            # Est-ce que le produit correspond à un des synonymes ?
            for syn in synonyms:
                if syn in prod_lower or prod_lower in syn:
                    return 1.0
            # Ou est-ce que le produit contient le nom clé ?
            if key in prod_lower:
                return 0.8
    return 0.0


# ---------------------------------------------------------------------------
# 4. Résolution principale
# ---------------------------------------------------------------------------

class ProductResolution:
    """Résultat de la résolution d'un ingrédient vers un produit."""

    def __init__(
        self,
        product: Product,
        score: float,
        pack_count: int,
        actual_grammage: Optional[int],
        reason: str = "",
    ):
        self.product = product
        self.score = score
        self.pack_count = pack_count
        self.actual_grammage = actual_grammage
        self.reason = reason

    def to_dict(self) -> Dict:
        return {
            "product_id": self.product.id,
            "product_name": self.product.name,
            "brand": self.product.brand,
            "brand_type": self.product.brand_type,
            "store_brand_affinity": self.product.store_brand_affinity,
            "category": self.product.category,
            "grammage_g": self.product.grammage_g,
            "volume_ml": self.product.volume_ml,
            "unit": self.product.unit,
            "image_url": self.product.image_url,
            "score": round(self.score, 4),
            "pack_count": self.pack_count,
            "actual_grammage": self.actual_grammage,
            "reason": self.reason,
        }


class ProductResolver:
    """Service de résolution d'ingrédients en produits du catalogue."""

    def __init__(self, db: Session):
        self.db = db

    def resolve(
        self,
        ingredient_name: str,
        ingredient_qty: float = 0.0,
        ingredient_unit: str = "unité",
        category_hint: Optional[str] = None,
        limit: int = 3,
    ) -> List[ProductResolution]:
        """Trouve les meilleurs produits pour un ingrédient donné.

        Args:
            ingredient_name: Nom de l'ingrédient (ex: "Lardons fumés").
            ingredient_qty: Quantité nécessaire (ex: 200.0).
            ingredient_unit: Unité de la quantité (ex: "g", "ml", "unité").
            category_hint: Indice de catégorie pour filtrer (ex: "charcuterie").
            limit: Nombre maximum de résultats à retourner.

        Returns:
            Liste des top N produits avec leurs scores et quantités calculées.
        """
        candidates = self._find_candidates(ingredient_name, category_hint)
        if not candidates:
            return []

        need_g = self._convert_to_grams(ingredient_qty, ingredient_unit)

        scored: List[Tuple[Product, float]] = []
        for product in candidates:
            score = self._compute_score(
                product=product,
                ingredient_name=ingredient_name,
                need_g=need_g,
            )
            scored.append((product, score))

        # Trier par score décroissant
        scored.sort(key=lambda x: x[1], reverse=True)

        results: List[ProductResolution] = []
        for product, score in scored[:limit]:
            pack_count, actual_grammage = self.compute_quantity(
                need_qty=ingredient_qty,
                need_unit=ingredient_unit,
                need_g=need_g,
                product=product,
            )
            results.append(ProductResolution(
                product=product,
                score=score,
                pack_count=pack_count,
                actual_grammage=actual_grammage,
                reason=self._generate_reason(product, score, scored),
            ))

        return results

    def _find_candidates(
        self,
        ingredient_name: str,
        category_hint: Optional[str] = None,
    ) -> List[Product]:
        """Trouve les produits candidats pour un ingrédient.

        Stratégie :
        a) Match ILIKE sur le nom
        b) Match par synonymes
        c) Match par catégorie (si category_hint)
        """
        candidates: Dict[int, Product] = {}
        name_lower = ingredient_name.strip().lower()

        # a) Match ILIKE sur le nom
        like_pattern = f"%{name_lower}%"
        stmt = select(Product).where(
            func.lower(Product.name).like(like_pattern)
        )
        for product in self.db.execute(stmt).scalars().all():
            candidates[product.id] = product

        # b) Match par synonymes
        synonyms = get_synonyms(name_lower)
        for syn in synonyms:
            syn_pattern = f"%{syn}%"
            stmt = select(Product).where(
                func.lower(Product.name).like(syn_pattern)
            )
            for product in self.db.execute(stmt).scalars().all():
                candidates[product.id] = product

        # c) Match par catégorie (si category_hint fourni)
        if category_hint:
            cat_pattern = f"%{category_hint.lower()}%"
            stmt = select(Product).where(
                func.lower(Product.category).like(cat_pattern)
            )
            for product in self.db.execute(stmt).scalars().all():
                candidates[product.id] = product

        # Si trop peu de candidats, ajouter les produits de même rayon/catégorie
        # que les candidats déjà trouvés
        if len(candidates) < 3 and candidates:
            categories = set()
            for p in candidates.values():
                if p.category:
                    categories.add(p.category)
            for cat in categories:
                stmt = select(Product).where(Product.category == cat)
                for product in self.db.execute(stmt).scalars().all():
                    candidates[product.id] = product

        return list(candidates.values())

    def _compute_score(
        self,
        product: Product,
        ingredient_name: str,
        need_g: float,
    ) -> float:
        """Calcule le score pondéré pour un couple produit-ingrédient."""
        score = 0.0

        # 1. Similarité de nom
        name_sim = name_similarity(ingredient_name, product.name)
        score += SCORE_WEIGHTS["name_similarity"] * name_sim

        # 2. Marque distributeur
        if product.store_brand_affinity:
            score += SCORE_WEIGHTS["store_brand"] * 1.0

        # 3. Préférence utilisateur
        pref_score = self._user_preference_score(product.id, ingredient_name)
        score += SCORE_WEIGHTS["user_preference"] * pref_score

        # 4. Historique d'achat
        hist_score = self._purchase_history_score(product.id)
        score += SCORE_WEIGHTS["purchase_history"] * hist_score

        # 5. Bonus synonyme
        syn_bonus = _synonym_bonus(ingredient_name, product.name)
        score += SCORE_WEIGHTS["synonym_bonus"] * syn_bonus

        # 6. Pénalité grammage
        penalty = _compute_grammage_penalty(product, need_g)
        score += SCORE_WEIGHTS["grammage_penalty"] * penalty

        return score

    def _user_preference_score(self, product_id: int, ingredient_name: str) -> float:
        """Calcule le score de préférence utilisateur (0.0 à 1.0)."""
        try:
            from app.models.product_preference import UserProductPreference
            stmt = select(UserProductPreference).where(
                UserProductPreference.ingredient_name == ingredient_name.strip().lower(),
                UserProductPreference.product_id == product_id,
            )
            pref = self.db.execute(stmt).scalar_one_or_none()
            if pref is None:
                return 0.0
            # Score basé sur le nombre de sélections (max 5 pour 1.0)
            return min(pref.count / 5.0, 1.0)
        except Exception:
            return 0.0

    def _purchase_history_score(self, product_id: int) -> float:
        """Calcule le score d'historique d'achat (0.0 à 1.0)."""
        try:
            from app.models.purchase_line import PurchaseLine
            stmt = select(func.count(PurchaseLine.id)).where(
                PurchaseLine.product_id == product_id
            )
            count = self.db.execute(stmt).scalar() or 0
            # Max 10 achats pour un score de 1.0
            return min(count / 10.0, 1.0)
        except Exception:
            return 0.0

    @staticmethod
    def _convert_to_grams(qty: float, unit: str) -> float:
        """Convertit une quantité en grammes pour le calcul de pénalité."""
        u = unit.strip().lower()
        if u in ("g", "gr", "gramme", "grammes"):
            return qty
        if u in ("kg", "kilo", "kilos", "kilogramme", "kilogrammes"):
            return qty * 1000.0
        if u in ("ml", "millilitre", "millilitres"):
            return qty  # approx g pour liquides
        if u in ("cl", "centilitre", "centilitres"):
            return qty * 10.0
        if u in ("l", "litre", "litres"):
            return qty * 1000.0
        return 0.0

    @staticmethod
    def compute_quantity(
        need_qty: float,
        need_unit: str,
        need_g: float,
        product: Product,
    ) -> Tuple[int, Optional[int]]:
        """Calcule la quantité de produit nécessaire (NEAREST_PACK).

        Args:
            need_qty: Quantité nécessaire dans l'unité d'origine.
            need_unit: Unité de la quantité nécessaire.
            need_g: Quantité nécessaire convertie en grammes.
            product: Produit à utiliser.

        Returns:
            Tuple (pack_count, actual_grammage).
        """
        # Si le produit est dénombrable (unit = 'unité') mais a un grammage
        pack_g = _get_grammage_g(product)
        prod_unit = (product.unit or "unité").strip().lower()

        if pack_g and need_g > 0:
            # NEAREST_PACK logic
            if need_g <= pack_g:
                return 1, pack_g
            if need_g < pack_g * 1.3:
                return 1, pack_g
            count = math.ceil(need_g / pack_g)
            return count, pack_g * count

        if prod_unit in ("unité", "unites", "unite") and need_g <= 0:
            # Produit dénombrable sans grammage
            count = max(1, math.ceil(need_qty))
            return count, None

        # Fallback
        return max(1, int(math.ceil(need_qty))), None

    @staticmethod
    def _generate_reason(
        product: Product,
        score: float,
        scored_list: List[Tuple[Product, float]],
    ) -> str:
        """Génère une raison lisible pour le choix du produit."""
        reasons = []

        if product.store_brand_affinity:
            reasons.append("Marque du magasin")

        if len(scored_list) >= 2:
            top_score = scored_list[0][1] if scored_list else score
            if product == scored_list[0][0] and score > 0:
                reasons.append("Meilleur score")

        if product.purchase_count >= 2:
            reasons.append("Deja achete")

        return ", ".join(reasons) if reasons else ""


# ---------------------------------------------------------------------------
# 5. Fonctions utilitaires (appelables directement)
# ---------------------------------------------------------------------------

def resolve_product(
    db: Session,
    ingredient_name: str,
    ingredient_qty: float = 0.0,
    ingredient_unit: str = "unité",
    category_hint: Optional[str] = None,
    limit: int = 3,
) -> List[Dict]:
    """Fonction utilitaire pour résoudre un ingrédient en produits.

    Args:
        db: Session SQLAlchemy.
        ingredient_name: Nom de l'ingrédient.
        ingredient_qty: Quantité nécessaire.
        ingredient_unit: Unité de la quantité.
        category_hint: Indice de catégorie.
        limit: Nombre max de résultats.

    Returns:
        Liste de dictionnaires représentant les produits résolus.
    """
    resolver = ProductResolver(db)
    results = resolver.resolve(
        ingredient_name=ingredient_name,
        ingredient_qty=ingredient_qty,
        ingredient_unit=ingredient_unit,
        category_hint=category_hint,
        limit=limit,
    )
    return [r.to_dict() for r in results]


def compute_quantity(
    need_qty: float,
    need_unit: str,
    product: Product,
) -> Tuple[int, Optional[int]]:
    """Calcule le nombre de packs nécessaires selon NEAREST_PACK.

    Args:
        need_qty: Quantité nécessaire.
        need_unit: Unité de la quantité.
        product: Produit à utiliser.

    Returns:
        Tuple (pack_count, actual_grammage).
    """
    need_g = ProductResolver._convert_to_grams(need_qty, need_unit)
    return ProductResolver.compute_quantity(need_qty, need_unit, need_g, product)
