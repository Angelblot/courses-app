# SPEC — Couche ALIMENT entre Recettes et Produits

**Auteur** : Agent PM/Technique  
**Date** : 28/04/2026  
**Version** : 1.0  
**Contexte** : Dans l'application courses-app, une recette stocke ses ingrédients avec un `product_id` optionnel pointant vers un produit précis du catalogue (ex: "Lardons fumés Carrefour"). Le wizard tente ensuite de faire correspondre cet ingrédient aux favoris de l'utilisateur, mais le matching est fragile car un ingrédient de recette est un concept **générique** ("lardons") alors qu'un produit est **spécifique** ("Allumettes de poulet Leclerc 150g"). Cette spec introduit une couche **ALIMENT** — ingrédient générique indépendant des marques/conditionnements — qui sert de pont entre les recettes et les produits du drive.

---

## 1. Concept d'aliment

### 1.1 Définition

Un **aliment** est un ingrédient générique, indépendant de toute marque ou conditionnement. Il représente le **quoi** (quoi acheter ?) avant le **qui** (quelle marque ?) et le **combien** (quel format ?).

Exemples :
- ✅ "Lardons" (aliment) → "Lardons fumés Carrefour 150g" (produit), "Allumettes Herta 100g" (produit)
- ✅ "Œufs" (aliment) → "Œufs Plein Air 6x" (produit), "Œufs Label Rouge 4x" (produit)
- ✅ "Pâtes" (aliment) → "Spaghetti Barilla 500g" (produit), "Penne De Cecco 500g" (produit)
- ❌ "Lardons fumés Carrefour" (trop spécifique, c'est un produit)
- ❌ "Crème liquide entière 30cl" (trop spécifique, c'est un produit)

### 1.2 Table `foods`

```sql
CREATE TABLE foods (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          VARCHAR(255) NOT NULL UNIQUE,
    -- Catégorie large pour le filtrage (ex: "charcuterie", "produit_laitier", "épicerie salée")
    category      VARCHAR(100),
    -- Unité par défaut pour les quantités (g, ml, unité)
    default_unit  VARCHAR(20) NOT NULL DEFAULT 'g',
    -- Synonymes (JSON Array) pour le matching flou :
    -- ["allumettes", "bacon", "poitrine fumée", "lardons nature"]
    synonyms      TEXT,
    -- URL d'une image illustrative de l'aliment (libre de droits / Open Food Facts)
    image_url     VARCHAR(500),
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_foods_name ON foods(name);
CREATE INDEX idx_foods_category ON foods(category);
```

**Champs** :

| Champ | Type | Description |
|---|---|---|
| `id` | INTEGER | PK auto-increment |
| `name` | VARCHAR(255) | Nom canonique, unique (ex: "Lardons fumés", "Œufs", "Crème fraîche") |
| `category` | VARCHAR(100) | Catégorie large (charcuterie, produit_laitier, epicerie, fruits_et_legumes, etc.) |
| `default_unit` | VARCHAR(20) | Unité par défaut : `g`, `ml`, ou `unité` |
| `synonyms` | TEXT | JSON array de variantes orthographiques/grammaticales. Ex: `["allumettes", "bacon", "poitrine fumée"]` |
| `image_url` | VARCHAR(500) | Image illustrative (optionnelle) |

### 1.3 Catalogue initial d'aliments

Les aliments sont créés à partir des noms d'ingrédients existants dans `recipe_ingredients` et des noms de produits. Estimation initiale : ~30-50 aliments couvrant les recettes existantes.

Catégories couvrant le catalogue actuel :

| Aliment | Catégorie | Unité par défaut | Synonymes |
|---|---|---|---|
| Lardons / allumettes | charcuterie | g | ["lardons", "allumettes", "bacon", "poitrine fumée"] |
| Œufs | produit_laitier | unité | ["oeufs", "œufs"] |
| Pâtes | epicerie | g | ["spaghetti", "tagliatelle", "penne", "pâtes"] |
| Crème fraîche | produit_laitier | ml | ["crème", "crème liquide", "crème épaisse"] |
| Lait | produit_laitier | ml | ["lait demi-écrémé", "lait entier"] |
| Beurre | produit_laitier | g | ["beurre doux", "beurre demi-sel"] |
| Fromage râpé | produit_laitier | g | ["parmesan", "gruyère râpé", "emmental râpé"] |
| Poulet | boucherie | g | ["blanc de poulet", "filet de poulet", "escalope"] |
| Pommes de terre | fruits_et_legumes | g | ["pdt", "patates"] |
| Oignon | fruits_et_legumes | unité | ["oignons", "échalote"] |
| Farine | epicerie | g | [] |
| Sucre | epicerie | g | [] |
| Sel | epicerie | g | [] |
| Poivre | epicerie | g | [] |
| Huile d'olive | epicerie | ml | [] |
| Salade | fruits_et_legumes | unité | ["laitue", "mâche", "roquette"] |
| Tomate | fruits_et_legumes | unité | ["tomates"] |
| Jus de citron | epicerie | ml | [] |

---

## 2. Association aliment ↔ produit

### 2.1 Table `food_products`

```sql
CREATE TABLE food_products (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    food_id       INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
    product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    -- Priorité : plus le chiffre est bas, plus le produit est recommandé en premier
    priority      INTEGER NOT NULL DEFAULT 100,
    -- Produit préféré pour cet aliment (un seul possible par aliment)
    is_preferred  BOOLEAN NOT NULL DEFAULT 0,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(food_id, product_id)
);

CREATE INDEX idx_food_products_food ON food_products(food_id);
CREATE INDEX idx_food_products_product ON food_products(product_id);
```

**Champs** :

| Champ | Type | Description |
|---|---|---|
| `food_id` | INTEGER FK → foods.id | Aliment associé |
| `product_id` | INTEGER FK → products.id | Produit associé |
| `priority` | INTEGER | Ordre de suggestion : 1 = meilleur choix, 100 = dernier recours |
| `is_preferred` | BOOLEAN | Produit recommandé par défaut pour cet aliment (un seul `TRUE` par `food_id`) |

### 2.2 Règles de priorité

L'algorithme de priorisation des produits pour un même aliment :

1. **Marque distributeur** (`brand_type = 'store_brand'`) > marque nationale > générique
2. **Prix au kilo** le plus bas (à isobrand type)
3. **Note / fréquence d'achat** (si l'utilisateur achète régulièrement un produit, il monte de priorité)
4. **Disponibilité** (un produit disponible dans tous les drives configurés passe devant)
5. **Grammage cohérent** (un pack de 150g pour un besoin de 200g est mieux qu'un pack de 1kg)

La priorité est **automatiquement recalculée** à chaque synchronisation des prix ou mise à jour des favoris. Le champ `priority` est la valeur calculée (on peut aussi la surcharger manuellement via API admin).

### 2.3 Exemple concret

```
Aliment "Lardons" (id=1)
├── Produit A : "Lardons fumés Carrefour 150g"  (priority=1, is_preferred=TRUE, store_brand)
├── Produit B : "Allumettes Herta 100g"          (priority=2, is_preferred=FALSE, marque nationale)
├── Produit C : "Bacon en dés Leclerc 200g"      (priority=3, is_preferred=FALSE, store_brand)
└── Produit D : "Poitrine fumée Carrefour 180g"  (priority=4, is_preferred=FALSE, store_brand)
```

---

## 3. Recette → aliment (remplacement de recette → produit)

### 3.1 Modification de la table `recipe_ingredients`

**Avant** :
```python
# recipe_ingredients.product_id : Optional[int] → FK vers products (nullable)
```

**Après** :
```sql
ALTER TABLE recipe_ingredients ADD COLUMN food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL;

-- Remplir food_id pour tous les enregistrements existants (via migration)
-- Puis : product_id devient un champ purement informatif/déprécié
-- (optionnel, gardé pour compatibilité ascendante le temps de la migration)
```

**Nouveau modèle** :

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `food_id` | Integer FK → foods.id | **OUI** | Aliment générique correspondant à cet ingrédient |
| `product_id` | Integer FK → products.id | Non (déprécié) | Ancien lien direct vers un produit — gardé pour compatibilité migration |

La règle devient : **un ingrédient de recette EST un aliment**. `food_id` est obligatoire. `product_id` n'est plus utilisé par le nouveau code (sauf pendant la transition).

### 3.2 Schémas Pydantic (mise à jour)

**`RecipeIngredientBase`** (nouveau champ) :
```python
class RecipeIngredientBase(BaseModel):
    """Champs communs d'un ingrédient de recette."""
    food_id: int  # REQUIS — aliment générique
    name: str = Field(..., min_length=1, max_length=255)
    quantity_per_serving: float = Field(0.0, ge=0)
    unit: str = Field("g", min_length=1, max_length=20)
    rayon: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    # product_id n'apparaît plus dans le create — il est résolu par le système
```

### 3.3 Comportement API Recettes

**POST /recipes** : À la création d'une recette, le frontend envoie `food_id` pour chaque ingrédient. Si l'aliment n'existe pas encore, deux options :
- **Option A (recommandée)** : L'API crée l'aliment automatiquement (voir section 6).
- **Option B** : L'API renvoie une erreur 422 si `food_id` inconnu.

**GET /recipes/{id}** : Les ingrédients renvoient `food_id` + les infos de l'aliment (name, default_unit, image_url) en embedded, ainsi que la liste des produits associés (`food_products`).

### 3.4 Route API aliments

```python
# Nouvelles routes dans backend/app/routes/foods.py

GET    /api/foods                       # Liste tous les aliments
GET    /api/foods/{id}                  # Détail d'un aliment + produits associés
POST   /api/foods                       # Créer un aliment
PUT    /api/foods/{id}                  # Modifier un aliment
DELETE /api/foods/{id}                  # Supprimer un aliment

# Association aliment ↔ produit
GET    /api/foods/{id}/products         # Produits associés à un aliment
POST   /api/foods/{id}/products         # Associer un produit à un aliment
DELETE /api/foods/{food_id}/products/{product_id}  # Dissocier
```

---

## 4. Flux Wizard avec aliments

### 4.1 Parcours utilisateur détaillé

#### Étape 0 — Sélection des recettes
L'utilisateur choisit ses recettes (inchangé). Pour chaque recette, il ajuste le nombre de parts.

#### Étape 1 — Consolidation des ingrédients avec résolution d'aliments
Le système agrège les ingrédients des recettes sélectionnées. Pour chaque ingrédient :

1. **Lookup aliment** : Lire `food_id` depuis `recipe_ingredients` → charger `Food`
2. **Lookup produits associés** : Charger `food_products` pour cet aliment, triés par `priority`
3. **Filtrage favoris utilisateur** : Parmi les produits associés, lesquels sont dans les favoris de l'utilisateur (`Product.favorite = TRUE`) ?
4. **Résolution** :
   - **Cas A** : Un favori match → afficher "Pour ta recette : 200g de lardons · Carbonara" avec le produit favori pré-sélectionné
   - **Cas B** : Aucun favori mais des produits existent → proposer le meilleur produit (priority=1) avec mention "Suggestions : Allumettes Herta 100g"
   - **Cas C** : Aucun produit associé → afficher l'ingrédient en texte libre "200g de lardons (à trouver)"

#### Étape 2 — Ajustement des quantités (NEAREST_PACK)
Pour chaque ingrédient résolu en produit :
- La **quantité de départ** du compteur est calculée par `NEAREST_PACK` : le nombre d'unités de vente nécessaires pour couvrir le besoin
- Exemple : besoin = 200g de lardons, produit = 150g → compteur à **2** paquets
- L'utilisateur peut ajuster à la hausse ou à la baisse

#### Étape 3 — Génération des paniers drive
Le `ListItem` créé pointe vers le `product_id` résolu (pas vers l'aliment). L'aliment a joué son rôle de pont.

### 4.2 Diagramme de flux

```
Recette "Carbonara"
  └── Ingrédient "Lardons" (food_id=1, qty=200g)
        │
        ▼
    Aliment "Lardons" (foods.id=1)
        │
        ├── FoodProduct (priority=1, is_preferred=TRUE)
        │     └── Produit "Lardons Carrefour 150g" (favori utilisateur ✅)
        │           ✓ → Affiche "200g de lardons · 2 paquets · Carbonara"
        │
        ├── FoodProduct (priority=2)
        │     └── Produit "Allumettes Herta 100g"
        │
        └── FoodProduct (priority=3)
              └── Produit "Poitrine fumée Carrefour 180g"
```

### 4.3 Modifications du code wizard

**Fichier `backend/app/routes/wizard.py`** — fonction `_consolidate()` :

```python
def _consolidate(payload, db):
    bucket = {}
    for r in payload.recipes:
        recipe = db.get(Recipe, r.recipe_id)
        if recipe is None:
            continue
        for ing in recipe.ingredients:
            # NOUVEAU : résoudre food_id → product_id préféré
            product_id = _resolve_best_product(db, ing.food_id)
            
            _add(WizardConsolidatedItem(
                name=ing.name,
                quantity=float(ing.quantity_per_serving) * r.servings,
                unit=ing.unit,
                rayon=ing.rayon,
                category=ing.category,
                product_id=product_id,  # résolu depuis food_id
                food_id=ing.food_id,    # NOUVEAU : garder la trace
            ))
    ...

def _resolve_best_product(db: Session, food_id: int) -> Optional[int]:
    """Trouve le meilleur produit pour un aliment (favori > priority > None)."""
    # 1. Chercher un FoodProduct avec is_preferred=TRUE
    fp = db.execute(
        select(FoodProduct).where(
            FoodProduct.food_id == food_id,
            FoodProduct.is_preferred == True,
        )
    ).scalar_one_or_none()
    if fp:
        return fp.product_id
    
    # 2. Chercher le FoodProduct avec la plus haute priorité
    fp = db.execute(
        select(FoodProduct).where(FoodProduct.food_id == food_id)
        .order_by(FoodProduct.priority.asc())
        .limit(1)
    ).scalar_one_or_none()
    if fp:
        return fp.product_id
    
    # 3. Fallback : pas de produit associé
    return None
```

### 4.4 Nouveau schéma `WizardConsolidatedItem`

```python
class WizardConsolidatedItem(BaseModel):
    """Ligne consolidée avec résolution aliment → produit."""
    name: str
    quantity: float
    unit: str
    rayon: Optional[str] = None
    category: Optional[str] = None
    product_id: Optional[int] = None      # Résolu depuis food_id (ou None)
    food_id: Optional[int] = None         # NOUVEAU : aliment source
    product_label: Optional[str] = None   # NOUVEAU : nom du produit suggéré
```

---

## 5. Migration des données existantes

### 5.1 Script de migration

Un script de migration `backend/scripts/migrate_foods.py` est exécuté une fois pour :

**Étape 1 — Créer les aliments à partir des ingrédients existants** :
```sql
-- Pour chaque nom unique dans recipe_ingredients.name (en lowercase, normalisé)
-- Créer un aliment (foods) avec ce nom
INSERT OR IGNORE INTO foods (name, category, default_unit, synonyms)
SELECT DISTINCT
    LOWER(TRIM(name)),
    -- Deviner la catégorie depuis le champ category ou category_hint
    COALESCE(category, category_hint, 'non_classé'),
    -- Deviner l'unité par défaut (g si quantité > 1 et l'unité ressemble à g/ml)
    CASE WHEN unit IN ('g', 'ml', 'cl', 'l', 'kg') THEN 'g' ELSE 'unité' END,
    -- Les synonymes sont laissés vides pour remplissage manuel
    '[]'
FROM recipe_ingredients;
```

**Étape 2 — Associer les produits aux aliments par similarité de nom** :
```sql
-- Pour chaque aliment, trouver les produits dont le nom contient le nom de l'aliment
-- (ou un de ses synonymes, si renseignés)
INSERT OR IGNORE INTO food_products (food_id, product_id, priority)
SELECT
    f.id,
    p.id,
    -- La priorité initiale est basée sur la similarité du nom
    CASE
        WHEN p.brand_type = 'store_brand' THEN 1
        WHEN p.favorite = TRUE THEN 2
        ELSE 3
    END
FROM foods f
JOIN products p ON LOWER(p.name) LIKE '%' || LOWER(f.name) || '%';
```

**Étape 3 — Mettre à jour `recipe_ingredients.food_id`** :
```sql
-- Pour chaque ingrédient existant, mapper à l'aliment correspondant
UPDATE recipe_ingredients SET food_id = (
    SELECT id FROM foods
    WHERE LOWER(name) = LOWER(TRIM(recipe_ingredients.name))
    LIMIT 1
);
```

**Étape 4 — Vérification** :
```sql
-- S'assurer qu'aucun ingrédient n'a food_id NULL après migration
-- Ceux qui restent NULL sont des cas ambigus → logging + curation manuelle
SELECT * FROM recipe_ingredients WHERE food_id IS NULL;
```

### 5.2 Gestion des ingrédients sans correspondance claire

Si un ingrédient existant ne peut être mappé à aucun aliment (nom trop spécifique, mal orthographié) :
- `food_id` reste NULL
- Le système traite l'ingrédient comme un **texte libre** (cas C du wizard)
- Un rapport de curation est généré pour remplissage manuel

### 5.3 Rétrocompatibilité

Pendant la migration :
- `product_id` reste dans `recipe_ingredients` (non supprimé)
- Le code existant qui lit `product_id` continue de fonctionner
- Après validation de la migration, `product_id` peut être déprécié puis supprimé dans une version ultérieure

---

## 6. Questions et décisions

### Q1 : Comment gérer les aliments sans produit associé ?
**Décision** : Le wizard affiche l'ingrédient en texte libre (cas C). L'utilisateur voit "200g de lardons (à trouver en magasin)". Pas de blocage, pas d'erreur. L'item est ajouté aux `missing_items` dans la réponse wizard.

### Q2 : Peut-on créer un aliment à la volée quand on ajoute une recette ?
**Décision** : **Oui**. Si le frontend envoie un `food_id` qui n'existe pas (ou un nom d'ingrédient qui ne correspond à aucun aliment), l'API le crée automatiquement :
- Nom = normalisé (lowercase, trim, accents retirés)
- Catégorie = `non_classé`
- Unité = devinée depuis l'unité de l'ingrédient
- Synonymes = `[]`
Un log est écrit pour suivi (permet d'enrichir le catalogue progressivement).

### Q3 : Faut-il une UI pour gérer les aliments ?
**Décision** : **Plus tard**. Dans cette version, seule l'API est exposée. Une interface d'administration (admin panel ou page settings) viendra dans une itération ultérieure. En attendant, les aliments peuvent être gérés via :
- API directe (curl, Postman, scripts)
- Seed data (fichier JSON d'amorçage)
- Base de données (SQLite browser)

### Q4 : Comment prioriser les produits pour un même aliment ?
**Décision** : Algorithme automatique (voir section 2.2) :
1. Marque distributeur > marque nationale > générique
2. Prix au kilo le plus bas
3. Fréquence d'achat utilisateur
4. Disponibilité multi-drive
5. Grammage optimal (pas trop loin du besoin médian)

Le champ `priority` est calculé automatiquement et peut être surchargé manuellement. Le champ `is_preferred` permet de verrouiller un choix par défaut.

### Q5 : Un aliment peut-il être associé à zéro produit ?
**Décision** : **Oui**. C'est le cas des ingrédients qui n'existent pas dans le catalogue (ex: "Gingembre frais", "Curcuma"). Le système les traite en texte libre. L'utilisateur peut les ajouter manuellement à sa liste.

### Q6 : Que faire des anciens `product_id` dans `recipe_ingredients` ?
**Décision** : Conservés pendant la transition, puis dépréciés. Pendant la migration :
- À la lecture : si `food_id` est présent, on utilise la résolution aliment → produit
- Si `food_id` est NULL mais `product_id` est présent (ancienne recette non migrée), on utilise `product_id` directement (fallback)
- Après N migrations réussies, `product_id` est supprimé de la table et du code

### Q7 : Comment gérer les synonymes ?
**Décision** : Stockés en JSON dans `foods.synonyms`. Utilisés par le resolver pour élargir le matching quand un ingrédient de recette a un nom légèrement différent de l'aliment canonique. Exemple :
- Recette dit "Allumettes" → synonymes de l'aliment "Lardons" contiennent "allumettes" → match réussi.

La table de synonymes actuellement hardcodée dans `product_resolver.py` (`INGREDIENT_SYNONYMS`) est migrée vers la base de données :
- Chaque clé devient un nom d'aliment
- Chaque valeur devient ses synonymes

---

## 7. Implémentation technique

### 7.1 Nouveaux fichiers

| Fichier | Type | Description |
|---|---|---|
| `backend/app/models/food.py` | Modèle SQLAlchemy | Classes `Food` et `FoodProduct` |
| `backend/app/schemas/food.py` | Schéma Pydantic | `FoodBase`, `FoodCreate`, `FoodOut`, `FoodProductCreate`, `FoodProductOut` |
| `backend/app/routes/foods.py` | Route FastAPI | CRUD aliments + associations |
| `backend/app/services/food_resolver.py` | Service | Logique de résolution aliment → meilleur produit |
| `backend/scripts/migrate_foods.py` | Script CLI | Migration one-shot des données existantes |

### 7.2 Modifications de fichiers existants

| Fichier | Changement |
|---|---|
| `backend/app/models/recipe.py` | Ajouter `food_id` à `RecipeIngredient`, supprimer dépendance à `product_id` |
| `backend/app/models/__init__.py` | Ajouter `Food`, `FoodProduct` aux exports |
| `backend/app/schemas/recipe.py` | Remplacer `product_id` par `food_id` dans `RecipeIngredientBase` |
| `backend/app/schemas/wizard.py` | Ajouter `food_id`, `product_label` à `WizardConsolidatedItem` |
| `backend/app/routes/wizard.py` | Modifier `_consolidate()` pour résoudre food_id → product_id |
| `backend/app/routes/__init__.py` | Ajouter `foods` router |
| `backend/app/main.py` | Enregistrer le router foods (si pas fait dans `__init__`) |
| `backend/app/services/product_resolver.py` | Déprécier `INGREDIENT_SYNONYMS` au profit de la DB |

### 7.3 Ordre d'implémentation recommandé

1. **Modèles** : `Food` + `FoodProduct` (models/food.py)
2. **Migration DB** : Script `migrate_foods.py` → créer les aliments, associer les produits, mettre à jour `recipe_ingredients`
3. **Schémas** : `FoodBase`, `FoodCreate`, `FoodOut`, etc. (schemas/food.py)
4. **Service** : `FoodResolver` (services/food_resolver.py) — logique de résolution aliment → produit
5. **Routes** : CRUD aliments (routes/foods.py)
6. **Modification recettes** : Mettre à jour `RecipeIngredient` + schémas + routes
7. **Modification wizard** : Mettre à jour `_consolidate()` pour utiliser `food_id`
8. **Nettoyage** : Supprimer `product_id` de `recipe_ingredients` (après validation)
9. **Seed data** : Remplir la table `foods` avec le catalogue initial + associations

---

## 8. Tests et validation

### 8.1 Tests unitaires

- Création d'un aliment
- Association d'un produit à un aliment
- Résolution aliment → produit (favori > priorité > aucun)
- Résolution avec synonymes
- Calcul de priorité automatique

### 8.2 Tests d'intégration

- Création d'une recette avec `food_id` via API
- Wizard qui résout correctement les ingrédients en produits
- Migration sans perte de données des recettes existantes
- Fallback correct quand `food_id` est NULL

### 8.3 Critères d'acceptation

- [ ] Tous les ingrédients des recettes existantes ont un `food_id` non NULL après migration
- [ ] Le wizard génère les mêmes listes qu'avant la migration (à validation identique)
- [ ] Un ingrédient sans produit associé n'empêche pas la génération du panier
- [ ] Créer une recette avec un nouvel aliment crée l'aliment automatiquement
- [ ] Les synonymes de l'ancien `product_resolver.py` sont repris dans la DB

---

## 9. Exemples de flux complets

### Scénario nominal : Carbonara avec favori

```
1. User sélectionne "Pâtes Carbonara" × 4 parts
2. Système charge la recette → ingrédients :
   - "Lardons" (food_id=1, qty=200g/part × 4 = 800g)
   - "Œufs" (food_id=2, qty=2/part × 4 = 8)
   - "Pâtes" (food_id=3, qty=100g/part × 4 = 400g)
   - "Crème fraîche" (food_id=4, qty=100ml/part × 4 = 400ml)
3. Pour chaque ingrédient :
   - Lardons → meilleur produit = "Lardons Carrefour 150g" (favori) → 6 paquets
     ✅ Affiche : "800g de lardons · Lardons Carrefour 150g · Pâtes Carbonara"
   - Œufs → meilleur produit = "Œufs Plein Air 6x" (favori) → 2 paquets
     ✅ Affiche : "8 œufs · Œufs Plein Air 6x · Pâtes Carbonara"
   - Pâtes → meilleur produit = "Spaghetti Barilla 500g" → 1 paquet
     ✅ Affiche : "400g de pâtes · Spaghetti Barilla 500g · Pâtes Carbonara"
   - Crème fraîche → aucun favori, meilleur produit = "Crème Fraîche Carrefour 200ml" → 2 paquets
     ✅ Affiche : "400ml de crème · Suggestion : Crème Fraîche Carrefour 200ml"
4. User valide → génération panier drive
```

### Scénario dégradé : épice sans produit

```
1. User sélectionne "Poulet au Curry" × 2 parts
2. Ingrédient "Curry" (food_id=50, qty=5g)
   - Aucun produit associé à l'aliment "Curry"
   ❌ Affiche : "5g de curry (à trouver en magasin)"
3. User peut ajouter manuellement un produit "Curry en poudre" depuis le catalogue
   OU laisser en texte libre (→ missing_items)
4. La génération continue sans bloquer
```

---

*Fin de la spec — Version 1.0*
