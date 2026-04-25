# SPEC — Matching Produit ↔ Ingrédient Recette : Normalisation des Unités

**Auteur** : Agent d'analyse  
**Date** : 25/04/2026  
**Version** : 1.0  
**Contexte** : L'utilisateur sélectionne une recette (ex: Pâtes Carbonara) dans le wizard. Dans la checklist quotidienne (DailyChecklist), un bandeau "Déjà prévu dans la recette" doit s'afficher quand un produit de la checklist correspond à un ingrédient de la recette. Actuellement, ce bandeau ne s'affiche pas (ou mal) à cause d'un mismatch d'unités.

---

## 1. Analyse de la Base de Données

### 1.1 Table `products`

```sql
CREATE TABLE products (
    id            INTEGER PRIMARY KEY,
    ean13         VARCHAR(13) UNIQUE,
    name          VARCHAR(255) NOT NULL,
    brand         VARCHAR(100),
    category      VARCHAR(100),
    default_quantity INTEGER NOT NULL DEFAULT 1,
    unit          VARCHAR(20) NOT NULL DEFAULT 'unité',
    ...
);
```

**Constat critique** : TOUS les 65 produits de la DB ont `unit = 'unité'`. Aucun produit n'a `unit = 'g'`, `'kg'`, `'ml'`, `'l'`, etc.  
Exemples :
| id | name | default_quantity | unit |
|----|------|-----------------|------|
| 6 | Œufs Plein Air | 4 | unité |
| 15 | Pâtes spaghetti n°5 | 1 | unité |
| 38 | Lardons fumés | 2 | unité |
| 41 | Filets de poulet | 1 | unité |
| 44 | Lait Demi-Écrémé | 4 | unité |
| 55 | Crème Fraîche | 1 | unité |

**Conclusion** : `default_quantity` représente le nombre d'**unités de vente** (paquets, bouteilles, barquettes). L'unité réelle (grammage, contenance) est implicite — non stockée en DB.

### 1.2 Table `recipes`

```sql
CREATE TABLE recipes (
    id             INTEGER PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    servings_default INTEGER NOT NULL DEFAULT 4,
    ...
);
```

5 recettes en base : Poulet rôti, Gratin dauphinois, Salade César, Pâtes Carbonara, Crêpes sucrées.

### 1.3 Table `recipe_ingredients`

```sql
CREATE TABLE recipe_ingredients (
    id                   INTEGER PRIMARY KEY,
    recipe_id            INTEGER NOT NULL,
    product_id           INTEGER,     -- nullable : peut être NULL si pas de lien vers un produit
    name                 VARCHAR(255) NOT NULL,
    quantity_per_serving FLOAT NOT NULL,
    unit                 VARCHAR(20) NOT NULL,
    rayon                VARCHAR(100),
    category             VARCHAR(100),
    FOREIGN KEY(recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
);
```

**Unités présentes** : `g`, `kg`, `ml`, `l`, `unité`, `branche`, `gousse`  

**Liaisons product_id** : Certains ingrédients ont un `product_id` (ex: lardons → product_id=38, œufs → product_id=6), d'autres non (ex: beurre, farine, parmesan râpé).

### 1.4 Exemple concret — Pâtes Carbonara (recipe_id=4)

| Ingrédient | qty/serv | unit | product_id | Produit lié |
|-----------|----------|------|------------|-------------|
| Spaghetti | 0.1 | kg | 15 | Pâtes spaghetti n°5 (1 unité) |
| Lardons fumés | 50.0 | g | 38 | Lardons fumés (2 unités) |
| Œufs | 1.0 | unité | 6 | Œufs Plein Air (4 unités) |
| Parmesan râpé | 25.0 | g | NULL | — |
| Crème liquide | 50.0 | ml | 55 | Crème Fraîche (1 unité) |

**Problème visible** : La recette demande `50g` de lardons, mais le produit "Lardons fumés" est en `unité` avec `default_quantity=2` (2 barquettes). Le bandeau ne matchera pas car `unitsCompatible('g', 'unité')` renvoie `false`.

---

## 2. Analyse du Code Existant

### 2.1 Fonction `getRecipeUsage` (wizardStore.js, ligne 141)

```js
export function getRecipeUsage({ productId, productName, productUnit, selectedRecipes, recipes }) {
```

**Logique actuelle** :
1. Itère sur toutes les recettes sélectionnées
2. Pour chaque ingrédient, tente un match :
   - **Match par ID** : `productId` du produit checklist === `ing.product_id`
   - **Match par nom** (si pas de match par ID) : compare les noms normalisés ET vérifie la compatibilité des unités via `unitsCompatible()`
3. Si match, ajoute `qty = ing.quantity_per_serving * servings` au breakdown

**Faille** : `unitsCompatible` est une comparaison stricte (===). Donc `'g' !== 'unité'` ⇒ pas de match, même si le nom correspond parfaitement. Le bandeau ne s'affiche pas.

### 2.2 Fonction `unitsCompatible` (wizardStore.js, ligne 137)

```js
function normalizeUnit(unit) {
  return (unit || 'unité').trim().toLowerCase();
}
function unitsCompatible(a, b) {
  return normalizeUnit(a) === normalizeUnit(b);
}
```

**Problème** : Comparaison == exacte. Aucune notion d'équivalence entre `g` et `kg`, `ml` et `l`, etc.

### 2.3 Fonction `normalizeName` (wizardStore.js, ligne 129)

```js
function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}
```

**Problème** : Compare `'œufs plein air carrefour'` (nom produit) avec `'œufs'` (nom ingrédient). Le `includes` bidirectionnel (`targetName.includes(ingName) || ingName.includes(targetName)`) est laxiste mais fonctionne. Cependant, utilisée uniquement si les unités matchent ⇒ donc de facto jamais utilisée pour les cas g≠unité.

### 2.4 Composant `RecipeUsageBanner` (RecipeUsageBanner.jsx)

```jsx
export function RecipeUsageBanner({ recipeUsage }) {
  if (!recipeUsage || recipeUsage.totalQuantity <= 0) return null;
  const unit = breakdown[0].unit || 'unité';
  const qty = formatQuantity(totalQuantity);
  const label = breakdown.length === 1
    ? `Déjà prévu : ${qty} ${unit} · ${breakdown[0].recipeName}`
    : `Déjà prévu : ${qty} ${unit} · ${breakdown.length} recettes`;
```

**Problème** : Si le breakdown est vide (pas de match d'unité), le banner n'apparaît pas. Si le match passe, l'unité affichée est celle de l'ingrédient (g, ml...), pas celle du produit (unité), ce qui peut être déroutant.

### 2.5 Composant `DailyChecklist` (DailyChecklist.jsx, ligne 184)

```jsx
recipeUsage={getRecipeUsage({
  productId: product.id,
  productName: product.name,
  productUnit: product.unit,   // ← toujours 'unité'
  selectedRecipes,
  recipes,
})}
```

Appel correct, mais les paramètres d'entrée (notamment `productUnit = 'unité'`) sont la cause racine du problème.

### 2.6 Fonction `buildConsolidatedItems` (wizardStore.js, ligne 185)

Utilise `keyOf(name, unit)` qui concatène nom+unité comme clé de bucket. Puisque les unités diffèrent (g vs unité), les ingrédients de recette et les produits quotidien ne fusionnent jamais ⇒ doublons dans le récap.

---

## 3. Cas de Mismatch Identifiés

### 3.1 Mismatch d'unités de masse

| Produit (unit = 'unité') | Ingrédient recette | Unité ingrédient | Problème |
|--------------------------|-------------------|-----------------|----------|
| Lardons fumés (2 unités = 2 barquettes) | Lardons fumés 50g | g | g ≠ unité |
| Parmesan râpé (N/A en produit) | Parmesan râpé 25g | g | Pas de produit lié |
| Farine (N/A en produit) | Farine 60g | g | Pas de produit lié |
| Beurre (N/A en produit) | Beurre 20g | g | Pas de produit lié |
| Poulet (1 unité = 1 barquette filets) | Poulet entier 0.35kg | kg | kg ≠ unité |
| Pommes de terre (1 unité = 1 filet) | Pommes de terre 0.25kg | kg | kg ≠ unité |
| Spaghetti (1 unité = 1 paquet 500g) | Spaghetti 0.1kg | kg | kg ≠ unité |

### 3.2 Mismatch d'unités de volume

| Produit | Ingrédient recette | Unité | Problème |
|---------|-------------------|-------|----------|
| Crème Fraîche (1 unité = 1 pot) | Crème liquide 50ml | ml | ml ≠ unité |
| Crème Fraîche (1 unité) | Crème liquide 0.1l | l | l ≠ unité |
| Lait (4 unités = 4 briques) | Lait 0.1l ou 0.15l | l | l ≠ unité |

### 3.3 Mismatch entre unités composables

| Ingrédient | Unité | Équivalent possible |
|-----------|-------|-------------------|
| g / kg | masse | 1 kg = 1000 g |
| ml / l / cl | volume | 1 l = 1000 ml, 1 cl = 10 ml |
| unité / pièce | dénombrable | 1 unité = 1 pièce |
| gousse / branche | dénombrable spécifique | Pas d'équivalent direct en produit |

### 3.4 Mismatch de nom

| Nom produit | Nom ingrédient | Problème |
|------------|---------------|----------|
| Œufs Plein Air (CARREFOUR) | Œufs | Nom long vs court |
| Lardons fumés conservation sans nitrite | Lardons fumés | Nom très long vs court |
| Pâtes spaghetti n°5 | Spaghetti | Différence de nom |
| Filets de poulet jaune CARREFOUR | Poulet entier / Blanc de poulet | Variante |
| Crème Fraîche Épaisse Légère 15% | Crème liquide | Produit différent (épaisse ≠ liquide) |

### 3.5 Cas particulier — `product_id` présent

Quand `recipe_ingredients.product_id` est non-null ET correspond à un produit existant, le matching par ID fonctionne (indépendant de l'unité). C'est le cas pour :
- Œufs (product_id=6) → match par ID OK
- Spaghetti (product_id=15) → match par ID OK
- Lardons (product_id=38) → match par ID OK
- Crème (product_id=55) → match par ID OK

**Mais** même avec un match par ID, le message affiche l'unité de l'ingrédient (g, kg, ml...), pas celle du produit (unité).

### 3.6 Cas particulier — `product_id` NULL

Environ la moitié des ingrédients n'ont pas de `product_id` associé (beurre, farine, parmesan, etc.). Le matching ne peut se faire que par nom — et échoue si les unités sont différentes.

### 3.7 Cas particulier — Unité "composite" (paquet, barquette, botte)

Le produit "Œufs Plein Air" a `default_quantity=4`, ce qui signifie "1 paquet de 4 œufs". La recette demande 1 œuf par part. Pour 4 parts, il faut 4 œufs = 1 paquet. Mais le système ne fait pas la conversion → le bandeau pourrait être trompeur.

### 3.8 Cas particulier — Produit non lié mais nom similaire

Un ingrédient "Crème liquide 50ml" (recette carbonara) est lié à product_id=55 (Crème Fraîche Épaisse). Le nom ne matcherait pas par texte (crème liquide ≠ crème fraîche épaisse), mais le `product_id` fait le lien. C'est un cas où le nom seul échouerait.

---

## 4. Solution Proposée

### 4.1 Architecture de la solution

Trois couches de matching, appliquées dans l'ordre :

1. **Matching par ID** (existant, à conserver)
2. **Matching par nom** avec **tolérance d'unité** (nouveau)
3. **Matching par catégorie/alias** (nouveau, pour les cas sans product_id)

### 4.2 Nouveau système d'équivalence d'unités

Créer un module `unitConverter.js` (ou intégré dans `wizardStore.js`).

**Table d'équivalence** :

```js
const UNIT_FAMILIES = {
  masse:   { base: 'g',   members: ['g', 'kg', 'mg'],       toBase: { g: 1, kg: 1000, mg: 0.001 } },
  volume:  { base: 'ml',  members: ['ml', 'cl', 'l', 'dl'], toBase: { ml: 1, cl: 10, l: 1000, dl: 100 } },
  piece:   { base: 'unité', members: ['unité', 'unites', 'pièce', 'piece', 'sachet', 'barquette', 'botte', 'branche', 'gousse'] },
};
```

**Fonction `unitsAreEquivalent(a, b)`** :
- Si `normalizeUnit(a) === normalizeUnit(b)` → true (identique)
- Si les deux sont dans la même famille de masse → true
- Si les deux sont dans la même famille de volume → true
- Si les deux sont dans "pièce" (dénombrable) → true
- Sinon → false

**Fonction `convertQuantity(qty, fromUnit, toUnit)`** :
- Si même unité → retourne qty
- Si dans la même famille (masse/volume) → convertit vers une base commune, puis vers l'unité cible
- Si dans la famille "pièce" → retourne qty (conversion 1:1)

### 4.3 Nouveau système de matching des noms

Remplacer la comparaison `includes` simple par un scoring :

```js
function namesMatch(productName, ingredientName) {
  const p = normalizeName(productName);
  const i = normalizeName(ingredientName);
  
  // Match exact
  if (p === i) return 1.0;
  
  // Un contient l'autre
  if (p.includes(i) || i.includes(p)) return 0.9;
  
  // Nettoyage des marques et suffixes produit
  const pClean = removeBrandSuffixes(p);  // "œufs plein air carrefour" → "œufs plein air"
  const iClean = removeBrandSuffixes(i);
  if (pClean === iClean) return 0.95;
  if (pClean.includes(iClean) || iClean.includes(pClean)) return 0.85;
  
  // Tokens partagés
  const pTokens = new Set(pClean.split(/\s+/));
  const iTokens = iClean.split(/\s+/);
  const intersection = iTokens.filter(t => pTokens.has(t));
  const ratio = intersection.length / Math.max(pTokens.size, iTokens.length);
  
  return ratio > 0.5 ? ratio * 0.8 : 0;
}
```

**Seuil de matching** : score ≥ 0.7 pour considérer un match.

### 4.4 Nouvelle fonction `getRecipeUsage` — logique complète

```js
export function getRecipeUsage({ productId, productName, productUnit, selectedRecipes, recipes }) {
```

**Algorithme** :

```
Pour chaque recette sélectionnée :
  Pour chaque ingrédient :
  
    CRITÈRE 1 — Match par ID (inchangé)
      if productId != null && ing.product_id != null && String(ing.product_id) === String(productId)
        → MATCH FORT (score = 1.0), bypass unit check
    
    CRITÈRE 2 — Match par nom AVEC tolérance d'unité
      if pas de match ID
        → calculer scoreNom = namesMatch(productName, ing.name)
        → if scoreNom >= SEUIL (0.7):
            si unitsAreEquivalent(productUnit, ing.unit)
              → MATCH MOYEN (score = scoreNom)
            sinon
              → MATCH FAIBLE (score = scoreNom * 0.5)
              → mais on match quand même (le bandeau s'affiche avec un avertissement "quantité approximative")
    
    Si MATCH :
      qty_recette = ing.quantity_per_serving * servings
      qty_affichee = convertQuantity(qty_recette, ing.unit, productUnit)
      
      Ajouter au breakdown {
        recipeName: recipe.name,
        qty: qty_recette,            // quantité en unité d'ingrédient (pour calcul)
        qtyDisplay: qty_affichee,    // quantité convertie en unité produit (pour affichage)
        unit: productUnit,           // unité du produit (pour affichage cohérent)
        unitOriginal: ing.unit,      // unité originale (pour info)
        matchType: 'id' | 'name',   // comment le match a été fait
        approximate: false,          // true si conversion approximative
      }
```

### 4.5 Nouveau composant `RecipeUsageBanner`

```jsx
export function RecipeUsageBanner({ recipeUsage }) {
  if (!recipeUsage || recipeUsage.totalQuantity <= 0) return null;
  
  const { totalQuantity, breakdown } = recipeUsage;
  if (!breakdown.length) return null;
  
  // Utiliser l'unité du produit pour l'affichage
  const unit = breakdown[0].unit || 'unité';
  const qty = formatQuantity(totalQuantity);
  const hasApproximate = breakdown.some(b => b.approximate);
  
  const label = breakdown.length === 1
    ? `Déjà prévu : ${qty} ${unit} · ${breakdown[0].recipeName}`
    : `Déjà prévu : ${qty} ${unit} · ${breakdown.length} recettes`;
  
  return (
    <div className={`recipe-usage-banner ${hasApproximate ? 'recipe-usage-banner--approx' : ''}`}>
      {label}
      {hasApproximate && <span className="recipe-usage-banner__hint">(quantité estimée)</span>}
    </div>
  );
}
```

### 4.6 Mise à jour de `buildConsolidatedItems`

Modifier la clé de bucket pour ignorer l'unité dans la déduplication :

```js
const keyOf = (name) => name.trim().toLowerCase(); // ← sans l'unité
```

Puis, quand on fusionne un ingrédient recette avec un produit quotidien :
- Si les unités diffèrent, garder l'unité du produit (la plus parlante pour l'utilisateur)
- Afficher la quantité convertie

### 4.7 Amélioration côté backend — Table de conversion

Optionnellement, ajouter une table `unit_conversions` en backend pour les conversions personnalisées :

```sql
CREATE TABLE unit_conversions (
    id              INTEGER PRIMARY KEY,
    product_id      INTEGER NOT NULL,
    from_unit       VARCHAR(20) NOT NULL,
    to_unit         VARCHAR(20) NOT NULL,
    conversion_rate FLOAT NOT NULL,   -- ex: pour lardons, 1 unité = 200g → rate = 200
    is_approximate  BOOLEAN DEFAULT TRUE,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);
```

Cela permettrait de dire :
- 1 unité de Lardons = 200g (approximatif)
- 1 unité de Spaghetti = 500g
- 1 unité de Crème Fraîche = 200ml

### 4.8 Priorisation des matchs

Quand un même produit match plusieurs ingrédients (ex: Œufs dans carbonara + crêpes), le breakdown doit montrer toutes les recettes concernées, avec les quantités additionnées ou séparées.

---

## 5. Plan de Migration

### Phase 1 — Frontend uniquement (immédiat)

1. Créer le module `unitConverter.js` avec :
   - `UnitFamily` enum et table d'équivalence
   - `unitsAreEquivalent(a, b)` → boolean
   - `convertQuantity(qty, fromUnit, toUnit)` → number
   - `namesMatch(productName, ingredientName)` → score 0-1

2. Modifier `getRecipeUsage` dans `wizardStore.js` :
   - Ajouter le scoring de nom
   - Remplacer `unitsCompatible` par `unitsAreEquivalent`
   - Ajouter le champ `approximate` dans le breakdown
   - Convertir les quantités pour l'affichage

3. Modifier `RecipeUsageBanner` :
   - Afficher l'unité du produit
   - Ajouter l'indication "quantité estimée" si `approximate`

4. Modifier `buildConsolidatedItems` :
   - Clé de bucket sans l'unité
   - Fusion des quantités avec conversion

### Phase 2 — Backend (amélioration)

1. Ajouter la table `unit_conversions` si nécessaire
2. Ajouter un endpoint `GET /api/unit-conversions` pour servir les taux
3. Dans le seed, ajouter des conversions par défaut pour les produits liés à des recettes

### Phase 3 — Données

1. Pour les ingrédients sans `product_id`, ajouter des liens dans `recipe_ingredients` si un produit correspondant existe
2. Ajouter un champ `grammage` ou `volume` optionnel sur `products` pour stocker la contenance réelle (ex: 500g pour un paquet de pâtes)

---

## 6. Conséquences et Risques

### Impacts positifs
- Le bandeau s'affiche pour TOUS les cas : œufs (unité↔unité), lardons (g↔unité), parmesan (g↔pas de produit), crème (ml↔unité)
- Les quantités sont converties et lisibles pour l'utilisateur
- Les doublons dans le récap sont réduits

### Risques
- **Faux positifs de nom** : "Crème Fraîche Épaisse" ≠ "Crème liquide" → peut matcher à tort. Mitigation : le score de nom basé sur les tokens donne un score plus bas pour ces cas.
- **Conversion approximative** : si 1 paquet de pâtes = 500g mais la recette demande 100g, afficher "0.2 paquets" est bizarre. Mitigation : utiliser `default_quantity` comme référence (1 paquet) et arrondir à l'unité supérieure.
- **Performance** : le scoring de nom sur N ingrédients × M produits peut être coûteux. Mitigation : mise en cache des résultats et calcul lazy.

### Décisions d'affichage
- Si la recette demande 50g de lardons et que le produit est "1 barquette (≈200g)", on affiche "Déjà prévu : ~0.25 barquette · Carbonara". Arrondir à 2 décimales.
- Si la conversion est trop complexe (branche/gousse), on affiche "Déjà prévu dans la recette" sans quantité.
- Toujours prioriser l'unité du produit dans l'affichage.

---

## 7. Exemples Concrets Après Correction

| Produit checklist | Ingrédient recette | Avant | Après |
|------------------|-------------------|-------|-------|
| Œufs Plein Air (4 unités) | Œufs 1 unité x4 parts = 4 | ✅ Match (unité=unité) | ✅ Match ID |
| Lardons fumés (2 unités) | Lardons fumés 50g x4 = 200g | ❌ Pas de match (g≠unité) | ✅ Match nom + équivalence masse, affiche "~1 barquette" |
| Spaghetti (1 unité) | Spaghetti 0.1kg x4 = 0.4kg | ❌ Pas de match (kg≠unité) | ✅ Match ID |
| Crème Fraîche (1 unité) | Crème liquide 50ml x4 = 200ml | ❌ Pas de match (ml≠unité) | ✅ Match ID (product_id) |
| (Pas de produit) | Parmesan râpé 25g x4 = 100g | N/A | N/A — toujours pas de produit |

---

## 8. Fichiers à Modifier

| Fichier | Modification |
|---------|-------------|
| `frontend/src/stores/wizardStore.js` | Remplacer `unitsCompatible` → `unitsAreEquivalent`, ajouter `namesMatch`, modifier `getRecipeUsage`, modifier `buildConsolidatedItems` |
| `frontend/src/components/wizard/RecipeUsageBanner.jsx` | Afficher unité produit, gérer le cas `approximate` |
| `frontend/src/utils/unitConverter.js` | **NOUVEAU** — module de conversion d'unités |
| `backend/app/models/recipe.py` | Optionnel : ajouter `grammage` au modèle Product |
| `backend/app/routes/seed.py` | Optionnel : seed des conversions |

---

## 9. Critères d'Acceptation

1. **Carbonara complète** : avec recette "Pâtes Carbonara" sélectionnée, les produits suivants doivent afficher le bandeau dans DailyChecklist :
   - Œufs Plein Air → "Déjà prévu : 4 unité · Pâtes à la carbonara"
   - Lardons fumés → "Déjà prévu : ~200g · Pâtes à la carbonara"
   - Spaghetti → "Déjà prévu : 0.4 kg · Pâtes à la carbonara"
   - Crème Fraîche → "Déjà prévu : 200 ml · Pâtes à la carbonara"

2. **Multi-recettes** : si Œufs est utilisé dans Carbonara + Crêpes, le bandeau doit additionner les quantités et mentionner "2 recettes".

3. **Approximation** : les conversions g↔unité sont marquées comme approximatives et affichent un indicateur visuel.

4. **Récap sans doublon** : dans l'étape Récap du wizard, un même produit (ex: Œufs) n'apparaît pas deux fois (une fois comme ingrédient recette, une fois comme produit quotidien).

5. **Nom long** : "Œufs Plein Air CARREFOUR" match "Œufs" correctement.

6. **Quantité affichée cohérente** : l'unité affichée dans le bandeau est toujours l'unité du produit de la checklist (pas celle de l'ingrédient).
