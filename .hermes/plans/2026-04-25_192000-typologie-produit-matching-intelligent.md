# Typologie Produit — Matching Intelligent des Substituts

> **Pour Hermes :** Utiliser `subagent-driven-development` pour implémenter ce plan.
> **Rappel :** Hermes ne code JAMAIS directement. Tout passe par Claude Code via `delegate_task` ou `terminal(claude ...)`.

**Goal :** Remplacer la couche ALIMENT (foods/food_products) par une approche de **typologie automatique** des produits. Le système analyse le nom de chaque produit et en extrait un type sémantique (ex: "lardon fumé", "pâte spaghetti", "crème liquide") qui sert de clé de matching entre les ingrédients de recettes et les produits de la liste.

**Problème actuel :** 
- La couche ALIMENT (foods + food_products) est une table intermédiaire qu'il faut maintenir manuellement (associer chaque aliment à chaque produit).
- Les allumettes et les lardons sont 2 produits distincts. L'utilisateur a les allumettes dans sa liste, la recette demande des lardons → aucun matching, les deux apparaissent en doublon.
- Le matching par catégorie + grammage échoue car les grammages sont souvent NULL.

**Solution : Typologie sémantique normalisée**

Chaque produit reçoit un champ `product_type` (backend) calculé automatiquement depuis son nom. Ce type sert de clé de matching dans le wizard :
- "Lardons fumés conservation sans nitrite" → `product_type = "lardon"`
- "Allumettes nature sans nitrite CARREFOUR" → `product_type = "lardon"` (car "allumette" est un synonyme connu de "lardon")
- "Crème Fraîche Epaisse Légère 15%" → `product_type = "crème liquide"`
- "Pâtes spaghetti n°5" → `product_type = "pâte"`

Dans `getRecipeUsage`, le matching se fait par `product_type` au lieu de `food_id` ou `matchByCategory`.

---

## Architecture

### Backend

**1. Normaliseur de noms** (`backend/app/services/product_typology.py`)
- Fonction `normalize_product_type(name: str) -> str` qui extrait le type depuis le nom
- Utilise des règles simples : mots-clés, synonymes, stopwords
- Exemples de règles :
  - "lardon", "allumette", "bacon", "poitrine fumée" → "lardon"
  - "pâte", "spaghetti", "tortellini", "gnocchi" → "pâte"
  - "crème", "crème fraîche", "crème liquide" → "crème liquide"
  - "œuf", "oeuf" → "œuf"
  - "parmesan", "parmigiano", "parmesan râpé" → "parmesan"
  - "beurre" → "beurre"
  - "lait" → "lait"
  - "fromage", "cheddar", "gorgonzola", "feta" → "fromage"
  - "poulet", "filet de poulet", "blanc de poulet" → "poulet"
  - etc.

**2. Migration DB** (`backend/scripts/migrate_product_types.py`)
- Ajoute la colonne `product_type` sur la table `products`
- Calcule et remplit `product_type` pour tous les produits existants
- Rendu idempotent

**3. API** (`backend/app/routes/products.py`)
- Le champ `product_type` est inclus dans les réponses JSON de `/api/products/`

### Frontend

**4. Refactor `getRecipeUsage`** (`frontend/src/stores/wizardStore.js`)
- Suppression de la logique `food_id` / foods (couche ALIMENT)
- Nouveau matching par `product_type` :
  - Match direct : `ing.product_id === product.id`
  - Match par type : `ing.product_type === product.product_type`
  - Si match par type → l'ingrédient est associé à ce produit (considéré comme le même)
  - Si plusieurs ingrédients matchent le même produit_type → cumul des quantités
- Fallback : matching par nom (pour les produits sans type)

**5. Nettoyage des composants**
- `DailyChecklist.jsx` : suppression du chargement `FoodsAPI.list()`
- `RecipeIngredientsSection.jsx` : idem
- Simplification des props passées à `getRecipeUsage`

---

## Plan d'implémentation

### Task 1: Créer le normaliseur de types produit

**Objectif :** Créer `backend/app/services/product_typology.py` avec la fonction `normalize_product_type(name)`

**Fichiers :**
- Create: `backend/app/services/product_typology.py`

**Détail :**
```python
# backend/app/services/product_typology.py

from typing import Optional

# Mapping : mot-clé (en minuscule) → product_type
TYPE_RULES = [
    # Charcuterie
    (["lardon", "allumette", "bacon", "poitrine fumée", "poitrine"], "lardon"),
    (["chorizo", "saucisson", "saucisse", "rosette"], "charcuterie"),
    (["pancetta", "coppa", "prosciutto"], "charcuterie"),
    # Pâtes & riz
    (["spaghetti", "pâte", "tortellini", "gnocchi", "coude", "tagliatelle", "penne", "fusilli"], "pâte"),
    (["riz", "risotto", "arborio", "basmati", "thaï", "jasmine"], "riz"),
    # Produits laitiers
    (["crème", "creme", "crème liquide", "creme liquide"], "crème liquide"),
    (["beurre"], "beurre"),
    (["lait"], "lait"),
    (["fromage", "cheddar", "gorgonzola", "feta", "parmigiano", "emmental", "comté", "gruyère"], "fromage"),
    (["parmesan"], "parmesan"),
    (["mozzarella", "mozza", "burrata"], "mozzarella"),
    (["yaourt", "yaourt nature", "yaourt grec", "skyr", "fromage blanc", "petit suisse"], "yaourt"),
    # Œufs
    (["œuf", "oeuf", "oeufs", "œufs"], "œuf"),
    # Légumes
    (["oignon", "oignons", "échalote", "echalote", "cébette"], "oignon"),
    (["carotte"], "carotte"),
    (["pomme de terre", "pommes de terre", "patate"], "pomme de terre"),
    (["ail", "gousse d'ail"], "ail"),
    (["tomate", "tomates", "tomate cerise"], "tomate"),
    (["salade", "laitue", "mâche", "roquette", "mesclun"], "salade"),
    # Fruits
    (["avocat"], "avocat"),
    (["banane"], "banane"),
    (["pomme"], "pomme"),
    # Viandes
    (["poulet", "filet de poulet", "blanc de poulet", "cuisse de poulet"], "poulet"),
    (["bœuf", "boeuf", "steak", "steack", "entrecôte", "faux-filet", "rumsteck", "haché"], "bœuf"),
    (["jambon", "jambon blanc", "jambon cru", "jambon fumé"], "jambon"),
    # Épicerie
    (["farine", "farine de blé"], "farine"),
    (["sucre"], "sucre"),
    (["sel"], "sel"),
    (["poivre", "poivre noir", "poivre blanc"], "poivre"),
    (["huile", "huile d'olive", "huile de tournesol"], "huile"),
    (["vinaigre"], "vinaigre"),
    (["café", "capsule", "dolce gusto", "nescafe"], "café"),
    (["biscuit", "cookie", "petit beurre", "granola"], "biscuit"),
    (["pain", "pain de mie", "baguette", "campagnard", "schär"], "pain"),
    (["chips", "cacahuète", "cacahuetes", "apéritif"], "apéritif"),
    # Sauces & condiments
    (["sauce soja", "soja"], "sauce soja"),
    (["moutarde"], "moutarde"),
    (["ketchup", "mayonnaise", "ketchup mayonnaise"], "condiment"),
    (["bouillon", "bouillon de volaille", "bouillon de légumes"], "bouillon"),
    # Boissons
    (["bière", "biere", "ipa", "blonde", "brune", "tourtel"], "bière"),
    (["vin", "vin blanc", "vin rouge", "rosé"], "vin"),
    (["jus", "jus d'orange", "jus de pomme", "innocent"], "jus"),
    # Hygiène & droguerie
    (["gel douche", "shampooing", "savon", "dentifrice", "déodorant"], "hygiène"),
    (["papier toilette", "mouchoir", "essuie-tout", "essuie main"], "papier"),
    (["brosse à dent", "brosse a dent"], "hygiène"),
    # Divers
    (["houmous", "humous"], "houmous"),
    (["muffin", "muffins"], "pâtisserie"),
    (["céréale", "céréales", "tresor", "kellogg", "chocapic"], "céréale"),
]

# Stopwords à ignorer dans le nom
STOPWORDS = {"carrefour", "classic'", "bio", "extra", "soft", "sensation",
             "eco", "planet", "essential", "simpl", "sans", "avec",
             "nature", "bio", "x", "lot", "pack", "maxi", "format",
             "économique", "economique", "familial", "g"}


def normalize_product_type(name: Optional[str]) -> Optional[str]:
    """Extrait le type sémantique d'un produit depuis son nom.
    
    Args:
        name: Nom du produit (ex: "Lardons fumés conservation sans nitrite HERTA")
    
    Returns:
        Type normalisé (ex: "lardon") ou None si non reconnu
    """
    if not name:
        return None
    
    name_lower = name.lower().strip()
    
    for keywords, product_type in TYPE_RULES:
        for keyword in keywords:
            if keyword in name_lower:
                return product_type
    
    # Fallback : premier mot significatif
    words = [w for w in name_lower.split() if w not in STOPWORDS and len(w) > 2]
    return words[0] if words else None
```

**Ajouter le script de test :**
```python
# backend/scripts/test_typology.py
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.services.product_typology import normalize_product_type

tests = [
    ("Lardons fumés conservation sans nitrite", "lardon"),
    ("Allumettes nature sans nitrite CARREFOUR", "lardon"),
    ("Pâtes spaghetti n°5", "pâte"),
    ("Crème Fraîche Epaisse Légère 15%", "crème liquide"),
    ("Œufs Plein Air", "œuf"),
    ("Parmigiano Reggiano râpé AOP", "parmesan"),
    ("Filets de poulet jaune CARREFOUR", "poulet"),
]

for name, expected in tests:
    result = normalize_product_type(name)
    status = "✓" if result == expected else "✗"
    print(f"{status} {name} → {result} (attendu: {expected})")
```

**Vérification :**
```bash
cd ~/courses-app/backend && python scripts/test_typology.py
```
Attendu : 6/6 ✓

---

### Task 2: Ajouter `product_type` à la table produits + migration

**Objectif :** Ajouter la colonne `product_type` au modèle Product et créer un script de migration/seed.

**Fichiers :**
- Modify: `backend/app/models/product.py` — ajouter `product_type = Column(String(100), nullable=True, index=True)`
- Modify: `backend/app/schemas.py` (ou fichier schémas) — ajouter `product_type` dans ProductResponse
- Create: `backend/scripts/migrate_product_types.py` — calcule et remplit `product_type` pour tous les produits

**Script de migration :**
```python
# backend/scripts/migrate_product_types.py
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.core.database import SessionLocal
from app.models.product import Product
from app.services.product_typology import normalize_product_type

def migrate_product_types():
    db = SessionLocal()
    try:
        products = db.query(Product).all()
        count = 0
        for p in products:
            ptype = normalize_product_type(p.name)
            if ptype and ptype != p.product_type:
                p.product_type = ptype
                count += 1
        db.commit()
        print(f"✓ {count} produits mis à jour avec un product_type")
    finally:
        db.close()
```

**Ajouter l'appel dans le startup de main.py** pour que Render seed automatiquement :
- Dans `backend/app/main.py`, après le seed existant (ligne ~56), ajouter :
```python
from app.services.product_typology import normalize_product_type
# ... dans le startup event ...
# Mise à jour des product_types
try:
    products_no_type = db.query(Product).filter(Product.product_type == None).all()
    for p in products_no_type:
        p.product_type = normalize_product_type(p.name)
    db.commit()
    if products_no_type:
        print(f"[AUTO-SEED] product_types: {len(products_no_type)}")
except Exception as e:
    print(f"[AUTO-SEED] product_types error: {e}")
```

---

### Task 3: Refactor `getRecipeUsage` — matching par product_type

**Objectif :** Remplacer la logique food_id/foods par le matching par product_type dans `getRecipeUsage`.

**Fichier :** `frontend/src/stores/wizardStore.js`

**Modifications :**
1. Supprimer le paramètre `foods` (plus besoin)
2. Dans la boucle des ingrédients, remplacer la logique foodMatch par un match sur `product_type`
3. Un ingrédient match un produit si : 
   - `ing.product_id === product.id` (match direct)
   - OU `ing.product_type === product.product_type` (même type sémantique)
4. Le match par type sémantique est traité comme un match **direct** (pas comme une substitution) — l'ingrédient est associé au produit, pas juste "substituable"
5. Supprimer la logique `matchByCategory` et `matchByCategoryFallback` — obsolètes si le product_type couvre
6. Garder `matchByName` comme fallback ultime

**Nouvelle signature :**
```javascript
export function getRecipeUsage({
  productId,
  productName,
  productUnit,
  product,
  selectedRecipes,
  recipes,
  allProducts = [],
}) {
```

**Logique de matching remplacée :**
```javascript
// Nouvelles conditions de matching (remplacer les lignes 182-284)
let matched = false;

// 1. Match direct (même product_id)
if (productId != null && ing.product_id != null && String(ing.product_id) === String(productId)) {
  matched = true;
}

// 2. Match par type sémantique (product_type)
if (!matched && product && product.product_type && ing.product_type) {
  if (ing.product_type === product.product_type) {
    matched = true;
  }
}

// 3. Fallback : match par nom
if (!matched) {
  const targetName = normalizeName(productName);
  const ingName = normalizeName(ing.name);
  if (targetName.length > 0 && ingName.length > 0 &&
      (targetName === ingName || targetName.includes(ingName) || ingName.includes(targetName))) {
    matched = true;
  }
}

if (!matched) return; // skip cet ingrédient
```

**Supprimer** tout le bloc de substitution (lignes 259-284) — avec le matching par type, les lardons et les allumettes matcheront directement le même ingrédient, donc pas besoin de substitution.

---

### Task 4: Nettoyer les composants frontend

**Objectif :** Supprimer le chargement des aliments (FoodsAPI) dans les composants.

**Fichiers :**
- Modify: `frontend/src/components/wizard/DailyChecklist.jsx`
  - Supprimer `import { FoodsAPI } from '../../services/api.js'`
  - Supprimer `const [foods, setFoods]` et `const [foodsLoaded, setFoodsLoaded]`
  - Supprimer l'effet `useEffect` qui charge `FoodsAPI.list()`
  - Supprimer le paramètre `foods` dans les appels à `getRecipeUsage`
- Modify: `frontend/src/components/wizard/RecipeIngredientsSection.jsx`
  - Mêmes suppressions

---

### Task 5: Ajouter `product_type` dans l'API produits

**Objectif :** Le champ `product_type` est inclus dans les réponses `/api/products/`.

**Fichier :** `backend/app/schemas.py` ou `backend/app/routes/products.py`

Si le modèle utilise Pydantic schemas, ajouter `product_type` aux response models.
Sinon, il sera automatiquement inclus si c'est un champ du modèle SQLAlchemy sérialisé.

**Vérifier que :**
```bash
curl -s http://localhost:8000/api/products/ | python -c "import json,sys; d=json.load(sys.stdin); print([(p['name'][:30], p.get('product_type')) for p in d[:5]])"
```

---

### Task 6: Supprimer la couche ALIMENT

**Objectif :** Nettoyer ce qui n'est plus utile.

**Fichiers à supprimer :**
- `backend/app/routes/foods.py` (plus besoin)
- `backend/app/services/food_resolver.py` (plus besoin)
- `backend/scripts/seed_aliments.py` (plus besoin)
- `backend/app/routes/seed_foods.py` (seed auto créé, pas besoin)

**Fichiers à vider/simplifier :**
- `backend/app/models/__init__.py` — enlever l'import Food, FoodProduct si pas utilisés ailleurs
- `backend/app/main.py` — enlever l'import et l'appel à `seed_aliments_db`

---

### Task 7: Commit final

```bash
cd ~/courses-app
git add -A
git commit -m "refactor: remplace couche ALIMENT par typologie produit intelligente"
git push origin main
```

---

## Vérification finale

1. Lancer le backend local : `cd backend && uvicorn app.main:app --reload --port 8000`
2. Lancer le frontend : `cd frontend && npm run dev`
3. Sur mobile (viewport 390×844) :
   - Sélectionner la recette "Pâtes à la carbonara - 4 pers."
   - Arriver à l'étape allumettes
   - Vérifier que le bandeau "Pour ta recette : Lardons fumés (200g)" apparaît
4. Le produit "Lardons fumés" ne devrait **pas** apparaître en double avec les allumettes
5. Vérifier dans le récap que les quantités sont cumulées correctement

---

## Notes

- La table `foods` et `food_products` reste en DB mais n'est plus utilisée par le frontend
- On pourra supprimer ces tables dans un futur cleanup (mais ça casse la rétrocompatibilité des seeds existants)
- Le service `FoodResolver` est obsolète mais on le garde au cas où (non supprimé)
- Si un produit n'a pas de `product_type`, le fallback par nom s'applique → rétrocompatibilité assurée
