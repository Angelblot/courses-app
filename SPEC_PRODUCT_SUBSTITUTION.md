# SPÉCIFICATION — Substitution de produits dans les recettes

## 1. Problème

### 1.1 Contexte

Actuellement, une recette stocke pour chaque ingrédient une référence directe (`product_id`) vers un produit du catalogue. Lors de la génération du panier, le système prend **exactement** ce produit.

**Exemple concret :**
- La recette "Pâtes à la carbonara" a un ingrédient `"Lardons fumés"` lié au produit `"Lardons fumés" (ID=12)`
- En DB, plusieurs produits correspondent à ce même besoin :
  - `Allumettes nature CARREFOUR 150g` (marque distributeur, 2,39 €)
  - `Lardons fumés Herta 100g` (marque nationale, 2,89 €)
  - `Poitrine fumée tranche fine 200g` (alternative)
- Mais le système ne propose que `"Lardons fumés"` — si ce produit a un `product_id` différent ou n'existe pas, l'ingrédient reste sans correspondance.

### 1.2 Douleur utilisateur

1. **Ingrédient non trouvé → pas de panier** : si le `product_id` de l'ingrédient ne matche aucun produit, l'item passe en "non trouvé". L'utilisateur doit resaisir manuellement sur le site drive.
2. **Pas de substitution intelligente** : l'utilisateur ne peut pas dire "prends la marque Carrefour, pas Herta".
3. **Grammage ignoré** : la recette demande 200g de lardons, le produit fait 150g. Le système ne sait pas s'il faut 1 ou 2 barquettes.
4. **Préférences silencieuses** : l'utilisateur achète toujours les mêmes marques, mais le système ne l'apprend pas.

### 1.3 Objectif

Permettre au système de **substituer intelligemment** un ingrédient de recette par le produit le plus pertinent disponible dans le catalogue, selon des critères configurables, et d'ajuster les quantités en fonction du grammage réel des produits.

---

## 2. Cas d'usage

### CU-1 : Substitution automatique par défaut
> Marc ajoute la recette "Pâtes à la carbonara" à sa semaine. L'ingrédient "Lardons fumés" matche plusieurs produits en DB. Le système choisit automatiquement "Allumettes nature CARREFOUR 150g" (marque distributeur du magasin) et ajuste la quantité : besoin 200g → 2 barquettes de 150g.

### CU-2 : Choix utilisateur dans le wizard
> Sophie utilise le wizard. Pour l'ingrédient "Lardons fumés", le système trouve 3 produits. Il affiche un bottom-sheet avec les 3 options, pré-sélectionne la moins chère. Sophie tape sur "Lardons fumés Herta 100g". Le système se souvient de ce choix pour la prochaine fois.

### CU-3 : Grammage auto-arrondi
> La recette demande 250g de crème fraîche. Le produit "Crème Fraîche 20cl" fait 200g. Le système détecte que 1 pot (200g) est proche de 250g, propose 1 pot plutôt que 2 (400g). L'utilisateur peut ajuster.

### CU-4 : Substitution de catégorie (produits composés)
> La recette demande "Allumettes" mais le seul produit en rayon est "Lardons fumés". Le système reconnaît que les deux sont des produits de charcuterie fumée et peut substituer l'un par l'autre (avec un indicateur visuel "Substitué").

### CU-5 : Fallback drive (scraper)
> Le système a proposé "Allumettes nature CARREFOUR 150g". Le scraper confirme que ce produit est indisponible au drive. Le système bascule automatiquement sur le second choix "Lardons fumés Herta 100g" et notifie l'utilisateur.

### CU-6 : Apprentissage des préférences
> Thomas a sélectionné "Herta" 3 fois de suite pour les lardons. Le système infère que c'est sa marque préférée dans cette sous-catégorie et propose Herta en premier la prochaine fois.

---

## 3. Approches possibles

### Approche A : Matching flou + scoring pondéré (recommandée)

**Principe :** Au lieu de lier un ingrédient à un seul `product_id`, on introduit une couche de **résolution** qui, pour un ingrédient donné, interroge le catalogue et classe les candidats par score.

**Algorithme de scoring :**

```
Score(produit, ingrédient, contexte) =
    w1 × match_nom(produit.name, ingrédient.name)
    + w2 × match_marque_distributeur(produit, magasin)
    + w3 × match_préférence_utilisateur(produit)
    + w4 × match_historique_achat(produit)
    + w5 × disponibilité_drive(produit)
    - w6 × écart_grammage(produit.grammage_g, besoin_g)
```

**Poids suggérés (ajustables) :**

| Critère | Poids | Source |
|---|---|---|
| `w1` Similarité de nom | 0.35 | Tokenisation + levenshtein |
| `w2` Marque distributeur | 0.20 | `store_brand_affinity` du produit vs drive config |
| `w3` Préférence utilisateur | 0.15 | Table `user_product_preferences` |
| `w4` Historique achat | 0.10 | `purchase_lines` count |
| `w5` Disponibilité scraper | 0.10 | Statut scraper (si connu) |
| `w6` Écart grammage | -0.10 | Pénalité si besoin non couvert |

**Grammage arrondi :** logique `NEAREST_PACK` :
- Si besoin ≤ grammage_produit → 1 unité (ex: besoin 80g, produit 150g → 1)
- Si grammage_produit < besoin < grammage × 1.3 → 1 unité (on tolère un léger manque)
- Si besoin ≥ grammage × 1.3 → ceil(besoin / grammage) unités
- Affichage : "(x2 pour couvrir 300g)"

**Stockage :** Nouveau champ `product_id` reste dans `RecipeIngredient` comme **suggestion éditoriale**, mais le résolveur peut en proposer un autre. Table `ingredient_resolutions` pour logger les résolutions appliquées.

**Avantages :** Flexible, explicable, auto-apprenant
**Inconvénients :** Plus complexe à implémenter, nécessite une table de préférences utilisateur

---

### Approche B : Table de correspondance manuelle (product_alternatives)

**Principe :** On ajoute une table `product_alternatives` qui relie un ingrédient (ou `product_id` source) à une liste de produits alternatifs ordonnés.

```
product_alternatives
  id           INT PK
  source_product_id INT FK → products.id
  target_product_id INT FK → products.id
  rank         INT         (1 = meilleur choix)
  auto_substitutable BOOL (true = substitution auto autorisée)
  created_at   TIMESTAMP
```

**Règles :**
- Si source = indisponible → prend rank 2
- Si auto_substitutable = false → demander validation utilisateur
- Pas de grammage auto : l'utilisateur voit "1 barquette de 150g"

**Avantages :** Simple, prévisible, contrôle total
**Inconvénients :** Maintenance manuelle lourde, ne scale pas avec le catalogue, pas d'apprentissage

---

### Approche C : Matching sémantique via embeddings + LLM

**Principe :** On encode les ingrédients et les produits en embeddings (via Sentence-BERT ou API LLM) et on fait du cosine-similarity pour trouver les meilleurs matchs.

```
1. Vectoriser "Lardons fumés" → vec_ingredient
2. Vectoriser tous les produits du rayon Charcuterie → vec_products
3. Top-3 produits par cos-sim(vec_ingredient, vec_product)
4. Contextualiser avec le drive choisi, le prix, le grammage
```

**Grammage arrondi :** Identique à l'approche A.

**Avantages :** Très puissant, gère les synonymes ("allumettes" ≈ "lardons"), scale bien
**Inconvénients :** Latence (appel API ou embedding on-the-fly), coût LLM si récurrent, nécessite un cache, difficile à debug ("pourquoi ce produit ?"), overkill pour un catalogue <200 produits

---

## 4. Recommandation

**Approche retenue : Approche A — Matching flou + scoring pondéré**

### Justification

1. **Catalogue modeste** (< 200 produits) : pas besoin d'embeddings. Un scoring basé sur des features simples fonctionne très bien.
2. **Transparence** : on peut expliquer à l'utilisateur pourquoi tel produit a été choisi ("Marque Carrefour recommandée pour ce drive").
3. **Évolutif** : les poids peuvent être ajustés sans refonte. On peut ajouter des critères (bio, local, promo) sans changer l'architecture.
4. **Auto-apprentissage progressif** : l'historique des choix utilisateur alimente `w3` et `w4`.
5. **Compatible avec l'existant** : `SearchStrategyService` et `ProductEquivalent` déjà en place peuvent alimenter `w2` et `w5`.

### Architecture

```
┌──────────────────┐
│  RecipeIngredient │  name="Lardons fumés", quantity=200g
│  (source)         │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  IngredientResolver                  │
│                                      │
│  1. Rechercher produits candidats    │
│     - par rayon (si renseigné)       │
│     - par ILIKE sur name             │
│     - par catégorie synonyme         │
│                                      │
│  2. Calculer score pour chaque       │
│     Cf. §3 scoring pondéré           │
│                                      │
│  3. Trier et proposer Top-3          │
│     - Meilleur score → auto-select   │
│     - Sinon → bottom-sheet choix     │
│                                      │
│  4. Ajuster quantité selon grammage  │
│     NEAREST_PACK rounding            │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  WizardItem / ShoppingList           │
│  product_id = produit retenu         │
│  quantity = quantité ajustée         │
│  substituted = True                  │
│  substitution_reason = "mdp" /       │
│    "user_choice" / "fallback"        │
└──────────────────────────────────────┘
```

### Nouvelles tables / champs

#### Table `ingredient_substitution_log`

```sql
CREATE TABLE ingredient_substitution_log (
    id              INT PK AUTO_INCREMENT,
    recipe_ingredient_id INT FK → recipe_ingredients.id,
    original_product_id  INT FK → products.id,      -- peut être NULL
    selected_product_id  INT FK → products.id,
    quantity_adjusted    FLOAT,                      -- quantité finale commandée
    grammage_pack_g      INT,                        -- grammage du pack choisi
    pack_count           INT,                        -- nombre d'unités commandées
    substitution_reason  VARCHAR(50),                -- "auto_score" / "user_choice" / "fallback_dispo" / "manual"
    resolver_score       FLOAT,                      -- score total du produit retenu
    user_id              INT,                        -- NULL si mono-utilisateur
    created_at           TIMESTAMP DEFAULT NOW()
);
```

#### Table `user_product_preferences`

```sql
CREATE TABLE user_product_preferences (
    id              INT PK AUTO_INCREMENT,
    user_id         INT,                              -- NULL si mono-utilisateur
    ingredient_name VARCHAR(255),                     -- nom normalisé de l'ingrédient
    preferred_product_id INT FK → products.id,
    preferred_brand      VARCHAR(100),                -- alternative : marque préférée
    last_selected_at TIMESTAMP,
    selection_count  INT DEFAULT 1,
    UNIQUE(user_id, ingredient_name, preferred_product_id)
);
```

#### Nouveaux champs sur `RecipeIngredient`

```python
# À ajouter au modèle
grammage_suggestion_g: Optional[int]  # Poids total suggéré pour l'ingrédient (calculé = quantity_per_serving × servings)
auto_substitutable: bool = True       # L'ingrédient peut être substitué automatiquement
```

### Logique de résolution détaillée

```
Fonction resolve_ingredient(ingredient, drive_name, user_prefs=None):

    1. CANDIDATS
       candidats = []
       # a) Match exact sur name (ILIKE)
       q1 = select(Product).where(Product.name.ilike(f"%{ingredient.name}%"))
       candidats += q1
       # b) Match par synonymes (table ingredient_synonyms)
       for synonym in get_synonyms(ingredient.name):
           candidats += select(Product).where(Product.name.ilike(f"%{synonym}%"))
       # c) Match par rayon (si ingrédient a un rayon et que des produits y sont)
       if ingredient.rayon:
           candidats += select(Product).where(Product.category == ingredient.rayon)

       candidats = deduplicate(candidats)

    2. SCORING
       for p in candidats:
           score = 0
           score += w1 * cosine_similarity(tokenize(ingredient.name), tokenize(p.name))
           score += w2 * (1 if p.brand_type == "store_brand" and p.store_brand_affinity == drive_name else 0)
           score += w3 * user_preference_score(p, ingredient.name, user_prefs)
           score += w4 * purchase_history_score(p)
           score += w5 * availability_score(p, drive_name)
           score += w6 * grammage_penalty(p, ingredient.total_weight)
           p._score = score

       candidats.sort(key=lambda p: p._score, reverse=True)
       return candidats[:3]

    3. GRAMMAGE (NEAREST_PACK)
       best = candidats[0]
       if best.grammage_g:
           if ingredient.total_weight <= best.grammage_g * 1.3:
               pack_count = 1
           else:
               pack_count = ceil(ingredient.total_weight / best.grammage_g)
           actual_weight = best.grammage_g * pack_count
       else:
           pack_count = 1
           actual_weight = ingredient.total_weight
```

### Affichage dans le wizard

#### Écran "Vérification des ingrédients" (entre le choix des recettes et la confirmation)

- Pour chaque ingrédient, afficher :
  - Nom, quantité nécessaire (ex: "200g")
  - Produit retenu (ex: "Allumettes nature CARREFOUR 150g")
  - Quantité commandée (ex: "×2 = 300g")
  - Badge "Marque du magasin" / "Moins cher" / "Choix fréquent" / "Substitué"
- Tap sur l'ingrédient → bottom-sheet avec alternatives classées par score
- Swipe left → ignorer / choisir manuellement un autre produit
- Si le système a un doute (écart de score < 0.1 entre top-1 et top-2) → pré-sélection mais avec indicateur "À vérifier"

#### Cas des ingrédients sans match

- Afficher "Ajouter manuellement : [nom]" avec un champ de recherche libre
- Proposer d'ajouter au catalogue + enrichir via Open Food Facts

---

## 5. Impact technique estimé

| Composant | Impact | Détail |
|---|---|---|
| **Modèles** | **Moyen** | Ajout table `ingredient_substitution_log`, `user_product_preferences`. Modification `RecipeIngredient` (2 champs). Aucune migration destructive. |
| **API** | **Moyen** | Nouveau endpoint `POST /api/ingredients/{id}/resolve` + `POST /api/ingredients/{id}/choose`. Modification de `POST /api/wizard/sessions` pour intégrer la résolution. |
| **Service** | **Fort** | Nouveau service `IngredientResolver` avec scoring, tokenisation, grammage rounding. Refactor de `_consolidate` dans wizard. |
| **Scraper** | **Faible** | Le fallback dispo (CU-5) nécessite une callback après scraping pour ajuster le choix. Déjà en partie couvert par `ProductEquivalent.last_confirmed_at`. |
| **Frontend** | **Moyen** | Nouveau composant `IngredientChoiceSheet` (bottom-sheet). Modification de l'affichage des items consolidés pour montrer substitution + grammage. |
| **Base de données** | **Faible** | 2 nouvelles tables. Pas de ré-indexation lourde. |
| **Tests** | **Moyen** | Tests unitaires sur le scoring, tests d'intégration sur la résolution + grammage. |

### Estimation effort

| Phase | Jours | Livrable |
|---|---|---|
| Modèles + migrations | 1 | Tables, champs, migration SQLite |
| Service `IngredientResolver` | 2 | Scoring, grammage, synonymes, cache |
| Endpoints API | 1 | `resolve`, `choose`, log |
| Intégration wizard | 1 | Appel resolver dans `_consolidate`, fallback |
| Frontend bottom-sheet | 1.5 | Composant choix ingrédient |
| Frontend affichage items | 0.5 | Badges, quantités ajustées |
| Tests | 1 | Unitaires + intégration |
| **Total** | **~8 jours** | |

---

## 6. Non couvert / Futur

### Non couvert (hors scope de cette spec)

1. **Multi-magasin en simultané** : la résolution se fait drive par drive. La comparaison Carrefour vs Leclerc pour un même ingrédient (prix, dispo) n'est pas traitée ici.
2. **Préférences diététiques** : vegan, sans gluten, sans lactose. Le scoring pourrait intégrer un tag `dietary_restriction` mais c'est un sujet plus large.
3. **Prix dynamique / promos** : le système ne tient pas compte des promos en cours. Une amélioration future pourrait pondérer `w4` par le prix remisé.
4. **Scan de code-barres** : l'utilisateur ne peut pas scanner un produit pour l'ajouter. Pourrait alimenter `user_product_preferences`.
5. **Produits libres (extras)** : les items saisis manuellement (extras) ne bénéficient pas de la substitution. Le resolver pourrait aussi les traiter si un lien vers le catalogue existe.

### Pistes futures

- **Tagging sémantique des ingrédients** : ajouter une table `ingredient_tags` (ex: `salty`, `smoked`, `pork`, `cheese`) pour faire de la substitution par similarité fonctionnelle plutôt que lexicale.
- **Mode "Économique" vs "Qualité"** : un toggle dans le wizard qui ajuste les poids du scoring (w2 vs w3) pour favoriser le moins cher ou la meilleure note.
- **Batch resolve des recettes favorites** : pré-calculer les substitutions pour les N recettes les plus utilisées, stocker en cache.
- **Export des logs de substitution** : pour analyse produit / amélioration du scoring.

---

## Annexe A — Table de synonymes (première version)

Configurable en dur dans `IngredientResolver` ou en table `ingredient_synonyms` :

| Ingrédient | Synonymes |
|---|---|
| lardons fumés | allumettes fumées, lardons nature, poitrine fumée, bacon |
| allumettes | lardons, bacon en dés, poitrine |
| crème fraîche | crème entière, crème liquide, crème épaisse |
| parmesan | parmigiano reggiano, grana padano, fromage râpé italien |
| filet de poulet | blanc de poulet, escalope de poulet, poulet jaune |
| pâtes | spaghetti, tagliatelle, penne, pâtes longues |
| oignon | oignon jaune, oignon blanc, oignon rouge, échalote |
| lait | lait demi-écrémé, lait entier, lait écrémé |

---

## Annexe B — Règle d'affichage des badges dans le wizard

| Condition | Badge affiché |
|---|---|
| Marque distributeur du drive choisi | 🏷️ Marque du magasin |
| Produit le moins cher du top-3 | 💰 Meilleur prix |
| Produit déjà acheté ≥ 2 fois | 🔄 Déjà acheté |
| Score top-1 ≈ top-2 (écart < 0.1) | ⚠️ À vérifier |
| Produit substitué (différent du `product_id` original) | 🔄 Substitué |
| Grammage ajusté (pack_count > 1) | 📦 ×N packs |

*Note : les badges utilisent des icônes dans l'interface (pas d'emojis, cf. conventions UI).*
