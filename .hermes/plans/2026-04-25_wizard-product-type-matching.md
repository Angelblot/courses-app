# Plan : Matching produit_type dans le wizard étape 2

**Date : 2026-04-25**
**Feature :** Quand l'utilisateur sélectionne une recette, le wizard propose automatiquement les produits du catalogue qui matchent par `product_type`, avec quantité ajustable et substitution possible.

---

## 1. Problème actuel

Le wizard a 4 étapes :
- **Étape 1** ✅ Swipe Tinder pour choisir recettes (Carbonara, Gratin, Crêpes)
- **Étape 2** ❌ DailyChecklist swipe produits favoris → ne montre PAS le matching ingrédients↔produits
- **Étape 3** ✅ Récapitulatif groupé par rayon
- **Étape 4** ✅ Sélection drives + génération

Le `product_type` est calculé côté backend (`normalize_product_type` → 49 règles), mais côté frontend le matching n'est pas exploité pour proposer automatiquement des produits aux ingrédients de recette.

## 2. État des lieux

### Ce qui existe déjà ✅
- **Backend** : `normalize_product_type(name)` → `"lardon"`, `"creme liquide"`, `"oeuf"`, etc. (49 règles)
- **Backend** : Modèle `Product` avec colonne `product_type` indexée, seedée au startup
- **Backend** : API `GET /api/recipes/` → ingrédients avec `product_type` calculé dynamiquement
- **Backend** : `GET /api/products/` → liste filtrée par product_type possible
- **Backend** : `ProductResolver` (matching flou avancé via /api/resolver/resolve)
- **Frontend** : `RecipeIngredientsSection.jsx` 🟡 existe mais **inutilisé** (jamais importé)
- **Frontend** : `ProductSubstitutionSheet.jsx` ✅ bottom-sheet de substitution top 3
- **Frontend** : `getRecipeUsage()` dans wizardStore.js → matching 3 niveaux (product_id, product_type, nom)
- **Frontend** : `RecipeUsageBanner.jsx` ✅ bannière "Pour ta recette : 200g" sur les cartes

### Ce qui manque ❌
1. **`RecipeIngredientsSection.jsx` ignore les ingrédients sans `product_id`** (ligne 45) — ne cherche pas par `product_type` automatiquement
2. **Pas d'étape dédiée** dans le wizard pour valider les ingrédients matchés aux produits
3. **Badge "Recette" / "Conso perso"** inexistant sur l'interface
4. **Allumettes classées "Produits laitiers"** au lieu de "Charcuterie" (bug seed data ou mapping)
5. **Substitution** : actuellement accessible via bouton "Alternatives" mais pas intégré dans le flux de validation

## 3. Solution proposée

### Architecture : Nouvelle sous-étape dans le wizard

```
Étape 1 : Choix recettes (swipe)     ← inchangé
    ↓
Étape 2a : Inventaire produits favoris  ← DailyChecklist actuelle, conserve RecipeUsageBanner
    ↓
Étape 2b : ☆ NOUVEAU ☆ Ingrédients recette → matching produits
    ↓
Étape 3 : Récapitulatif rayon         ← inchangé
Étape 4 : Drives + génération          ← inchangé
```

### Détail de l'étape 2b : "Les ingrédients de tes recettes"

Pour chaque ingrédient de chaque recette sélectionnée :

1. **Match par `product_type`** : cherche dans tous les produits du catalogue ceux dont `product_type` === `ingredient.product_type`
2. **Si trouvé (ex: Carbonara → lardon → Allumettes)** :
   - Affiche la carte produit avec image, nom, marque, prix
   - Badge "Recette" (quantité nécessaire) + champ quantité ajustable
   - Option "Ajouter X pour toi" (conso perso)
   - Bouton "Changer" → ouvre ProductSubstitutionSheet avec les équivalents
3. **Si pas trouvé (ex: un ingrédient sans produit correspondant)** :
   - Affiche l'ingrédient générique (nom + quantité)
   - Badge "Recette" + champ quantité
   - Bouton "Trouver un produit" → ouvre ProductSubstitutionSheet (recherche par nom)
   - Si plusieurs équivalents possibles, les propose avec `product_type`

### Correction Allumettes

Le bug "Allumettes en Produits laitiers" vient probablement de la seed data :
- Soit `seed_data.json` assigne une `category` erronée
- Soit le CSV d'import initial
- Soit le `product_type` calculé est bon (`lardon`) mais la catégorie affichée (`rayon`) est stockée séparément
- **Action** : Vérifier la seed data et corriger la catégorie du produit "Allumettes nature sans nitrite CARREFOUR"

## 4. Fichiers à modifier

### Backend (Claude Code)
| Fichier | Modification |
|---------|-------------|
| `backend/scripts/seed_data.py` (ou JSON) | Corriger catégorie "Allumettes" → Charcuterie |
| `backend/app/routes/recipes.py` ou `products.py` | Optionnel : endpoint `GET /api/products/by-product-type?types=lardon,oeuf` pour requêter en un seul appel |

### Frontend (Claude Code)
| Fichier | Modification |
|---------|-------------|
| `frontend/src/components/wizard/RecipeIngredientsSection.jsx` | **Réactiver** : remplacer le `if (ing.product_id == null) return;` par une recherche par `product_type` |
| `frontend/src/stores/wizardStore.js` | Ajouter fonction `getIngredientsByProductType(items)` qui retourne les ingrédients matchés par `product_type` |
| `frontend/src/components/wizard/RecipeIngredientsSection.jsx` | Ajouter badges "Recette" / "Conso perso" + quantité ajustable |
| `frontend/src/pages/WizardPage.jsx` (ou équivalent) | Ajouter l'étape 2b après DailyChecklist |
| `frontend/src/components/wizard/DailyChecklist.jsx` | Optionnel : ajuster le flux pour inclure le passage à 2b |

### Tests / Validation
- `tests/e2e/test_full_parcours.py` | Ajouter screenshots de l'étape 2b avec matching visible
- Vérifier visuellement : Allumettes proposée pour Carbonara

## 5. Workflow de réalisation

1. **PM** : Valider ce plan avec le Boss (Angelo)
2. **UX** : Proposer le design de l'étape 2b (cartes swipe vs liste, badges, quantités)
3. **Dev Backend** : Corriger catégorie Allumettes + endpoint optionnel
4. **Dev Frontend** : Réactiver RecipeIngredientsSection + intégration wizard
5. **Test** : Capturer vidéo du parcours complet avec matching visible
6. **Validation** : Boss teste, ajustements, push

## 6. Questions ouvertes

1. L'étape 2b doit-elle être un swipe (comme l'étape 1) ou une liste avec validation bouton "Tout accepter" ?
2. Doit-on afficher TOUS les ingrédients de toutes les recettes d'un coup, ou un par un (swipe) ?
3. Les quantités de conso perso : faut-il les stocker en base ou juste en session ?
4. Si deux recettes différentes demandent le même `product_type` (ex: Carbonara + une autre recette avec lardons), comment consolider l'affichage ?

---

## Annexe : Règles product_type existantes (extrait)

```
"allumette" → "lardon"
"lardon" → "lardon"  
"creme fraiche" → "creme liquide"
"creme liquide" → "creme liquide"
"oeuf" → "oeuf"
"pates" → "pâtes"
"spaghetti" → "pâtes"
"farine" → "farine"
"beurre" → "beurre"
"sel" → "sel"
"poivre" → "poivre"
"parmesan" → "parmesan"
"ail" → "ail"
"oignon" → "oignon"
"pomme de terre" → "pomme de terre"
"lait" → "lait"
"jambon" → "jambon"
"fromage rape" → "fromage râpé"
"cheddar" → "cheddar"
"mozzarella" → "mozzarella"
"chorizo" → "chorizo"
"poulet" → "poulet"
"boeuf hache" → "viande hachée"
"saumon" → "saumon"
"crevette" → "crevette"
"conserve tomate" → "tomate concassée"
"concentré tomate" → "concentré tomate"
"huile olive" → "huile olive"
"vinaigre" → "vinaigre"
"moutarde" → "moutarde"
"sucre" → "sucre"
"chocolat" → "chocolat"
"banane" → "banane"
"pomme" → "pomme"
"carotte" → "carotte"
"champignon" → "champignon"
"salade" → "salade"
"tomate" → "tomate"
"concombre" → "concombre"
"courgette" → "courgette"
"poivron" → "poivron"
"café" → "café"
"thé" → "thé"
"jus orange" → "jus orange"
"eau" → "eau"
"biere" → "bière"
"vin" → "vin"
"yaourt" → "yaourt"
"fromage" → "fromage"
```
