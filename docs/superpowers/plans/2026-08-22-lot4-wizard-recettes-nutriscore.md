# Lot 4 — Wizard, recettes et Nutriscore — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour dérouler ce plan tâche par tâche. Les étapes
> emploient la syntaxe à cases (`- [ ]`).

**But :** porter le wizard de génération de liste sur mobile, permettre de créer
des recettes, et afficher le Nutriscore.

**Architecture :** les fonctions pures du wizard web changent de fichier sans
changer de comportement. L'état des cinq étapes vit dans un contexte React. Le
mode tinder est réécrit pour React Native — c'est le seul vrai portage, les
événements de pointeur et les transformations CSS n'existant pas là-bas.

**Pile :** Expo SDK 57, React Native 0.86, expo-router, TypeScript, Supabase JS
2.112, `react-native-gesture-handler` 2.32, `node:test`.

**Spécification :** `docs/superpowers/specs/2026-08-22-lot4-wizard-recettes-nutriscore-design.md`

## Contraintes globales

- **Tests : Node ≥ 22 obligatoire.** La version par défaut de la machine est la
  20, qui ne charge pas les `.ts`. Commande de référence, depuis `mobile/` :
  `/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs`
- **Aucune nouvelle dépendance native.** Ni `react-native-reanimated`, ni
  `zustand`, ni `expo-clipboard`. `react-native-gesture-handler` est déjà
  installé ; l'animation passe par `Animated` du cœur de React Native. Ajouter un
  pod imposerait un `prebuild` et déstabiliserait la chaîne Xcode Cloud.
- **Zéro emoji dans l'interface.** Jamais, nulle part.
- **Thème clair uniquement.** Couleurs, espacements et arrondis viennent de
  `lib/theme.ts` — jamais de valeur littérale.
- **Messages d'erreur en français**, jamais `error.message` brut à l'écran ; le
  détail technique part à `console.error`.
- **Imports internes en `.ts` explicite** (`from './unites.ts'`).
- **TypeScript :** 2 espaces, composants fonctionnels, camelCase, PascalCase pour
  les composants.
- **Ne rien pousser avant la tâche 14.** Xcode Cloud surveille `mobile/` sur
  `mobile/expo-scan` avec « Auto-cancel Builds » : chaque poussée déclenche un
  build et annule le précédent. Les commits restent locaux.
- **Les tâches d'interface décrivent le comportement, les états et les textes
  exacts, pas le balisage.** Le JSX suit les composants existants —
  `components/FicheScannee.tsx`, `components/ProductRow.tsx`, `app/login.tsx` :
  `StyleSheet.create` en fin de fichier, jetons de `lib/theme.ts`, `Pressable`
  plutôt que `TouchableOpacity`. Reproduire des centaines de lignes de balisage
  dans ce plan les figerait sans rien garantir ; les états à couvrir, eux, sont
  énumérés et ne se devinent pas.
- **Il n'existe aucun test des fonctions pures du wizard côté web** — seul
  `extensionList.test.mjs` en a. Ceux de ce plan sont écrits, pas portés.

---

## Phase 1 — Fondations

### Tâche 1 : un seul vocabulaire de rayons

**Fichiers :**
- Créer : `supabase/migrations/0006_rayons_ingredients.sql`
- Modifier : `mobile/lib/rayons.ts`
- Test : `mobile/lib/rayons.test.mjs`

**Interfaces :**
- Consomme : `CleRayon`, `RAYONS` de `lib/rayons.ts`.
- Produit : `rayonDepuisLibelle(libelle: string | null | undefined): CleRayon`.

- [x] **Étape 1 : écrire le test qui échoue**

Ajouter à la fin de `mobile/lib/rayons.test.mjs` :

```js
test('les libellés des ingrédients migrés se ramènent aux clés canoniques', () => {
  assert.equal(rayonDepuisLibelle('Produits laitiers'), 'pls');
  assert.equal(rayonDepuisLibelle('Fruits et légumes'), 'fruits_legumes');
  assert.equal(rayonDepuisLibelle('Épicerie'), 'epicerie');
  assert.equal(rayonDepuisLibelle('Charcuterie'), 'charcuterie');
});

test('« Boucherie » suit Carrefour et tombe en P.L.S.', () => {
  // Les 10 rayons viennent des sections du ticket Carrefour, où la boucherie
  // n'existe pas : « Filets de poulet jaune CARREFOUR » y est rangé en P.L.S.
  assert.equal(rayonDepuisLibelle('Boucherie'), 'pls');
});

test('la reconnaissance ignore casse, accents et esperluette', () => {
  assert.equal(rayonDepuisLibelle('FRUITS & LEGUMES'), 'fruits_legumes');
  assert.equal(rayonDepuisLibelle('epicerie'), 'epicerie');
  assert.equal(rayonDepuisLibelle('Charcuterie & traiteur'), 'charcuterie');
});

test('un libellé inconnu ou absent tombe en « autre »', () => {
  assert.equal(rayonDepuisLibelle('Cave à vin'), 'autre');
  assert.equal(rayonDepuisLibelle(''), 'autre');
  assert.equal(rayonDepuisLibelle(null), 'autre');
});

test('une clé canonique passée par mégarde est rendue telle quelle', () => {
  // Le récapitulatif mélange des ingrédients (libellés) et des produits (clés).
  assert.equal(rayonDepuisLibelle('pls'), 'pls');
  assert.equal(rayonDepuisLibelle('fruits_legumes'), 'fruits_legumes');
});
```

Ajouter `rayonDepuisLibelle` à l'import en tête du fichier :

```js
import { rayonDepuisCategories, rayonDepuisLibelle, libelleRayon, RAYONS } from './rayons.ts';
```

- [x] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/rayons.test.mjs
```

Attendu : ÉCHEC, `rayonDepuisLibelle is not a function`.

- [x] **Étape 3 : écrire l'implémentation**

Ajouter à la fin de `mobile/lib/rayons.ts` :

```ts
/**
 * Ramène un libellé de rayon en clair vers une clé canonique.
 *
 * `recipe_ingredients.rayon` porte un troisième vocabulaire, saisi à la main :
 * « Produits laitiers », « Fruits et légumes », « Boucherie ». Sans cette
 * traduction, le récapitulatif afficherait le même rayon deux fois sous deux
 * noms — une fois pour les ingrédients, une fois pour les produits.
 *
 * Accepte aussi une clé canonique telle quelle : le récapitulatif mélange des
 * lignes venant des ingrédients (libellés) et des produits (clés).
 */
const LIBELLES: ReadonlyArray<readonly [string, CleRayon]> = [
  ['produits laitiers', 'pls'],
  ['pls', 'pls'],
  // Carrefour n'a pas de rayon boucherie : la volaille est en P.L.S.
  ['boucherie', 'pls'],
  ['volaille', 'pls'],
  ['fruits et legumes', 'fruits_legumes'],
  ['fruits legumes', 'fruits_legumes'],
  ['charcuterie', 'charcuterie'],
  ['charcuterie et traiteur', 'charcuterie'],
  ['traiteur', 'charcuterie'],
  ['epicerie', 'epicerie'],
  ['boissons', 'boissons'],
  ['surgeles', 'surgeles'],
  ['droguerie', 'droguerie'],
  ['hygiene', 'parfumerie'],
  ['parfumerie', 'parfumerie'],
  ['maison', 'maison'],
];

export function rayonDepuisLibelle(libelle: string | null | undefined): CleRayon {
  if (!libelle) return 'autre';
  const n = libelle
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')  // points de code : ces marques sont invisibles en clair
    .replace(/&/g, 'et')
    .replace(/[^a-z_ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!n) return 'autre';
  // Clé canonique passée telle quelle.
  const cle = RAYONS.find((r) => r.cle === n);
  if (cle) return cle.cle;
  const trouve = LIBELLES.find(([l]) => l === n);
  return trouve ? trouve[1] : 'autre';
}
```

- [x] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/rayons.test.mjs
```

Attendu : `# fail 0`, au moins 12 tests.

- [x] **Étape 5 : écrire la migration**

Créer `supabase/migrations/0006_rayons_ingredients.sql` :

```sql
-- Normalise recipe_ingredients.rayon vers les clés canoniques de la table
-- categories, comme 0005 l'a fait pour products.category.
--
-- Ce champ portait un troisième vocabulaire, saisi à la main :
-- « Produits laitiers », « Fruits et légumes », « Boucherie ». Sans cette
-- normalisation, le récapitulatif du wizard afficherait le même rayon deux
-- fois sous deux noms — les ingrédients d'un côté, les produits de l'autre.
--
-- « Boucherie » devient pls : les 10 rayons viennent des sections du ticket
-- Carrefour, où la boucherie n'existe pas. « Filets de poulet jaune
-- CARREFOUR » y est rangé en P.L.S., et c'est là que l'utilisateur ira le
-- chercher dans le drive.

update public.recipe_ingredients set rayon = case
  when lower(rayon) like 'produits laitiers%' then 'pls'
  when lower(rayon) like 'boucherie%'          then 'pls'
  when lower(rayon) like 'fruits%'             then 'fruits_legumes'
  when lower(rayon) like 'charcuterie%'        then 'charcuterie'
  when lower(rayon) like '%picerie%'           then 'epicerie'
  when lower(rayon) like 'boissons%'           then 'boissons'
  when lower(rayon) like 'surgel%'             then 'surgeles'
  else 'autre'
end
where rayon is not null;

update public.recipe_ingredients set rayon = 'autre' where rayon is null;
```

- [x] **Étape 6 : appliquer et vérifier**

Appliquer par l'outil MCP Supabase `apply_migration`, projet
`qmymwicsgilhoihtfdjm`, nom `rayons_ingredients`.

Vérifier ensuite :

```sql
select rayon, count(*) from public.recipe_ingredients group by rayon order by 2 desc;
```

Attendu : uniquement `pls` (14), `fruits_legumes` (7), `epicerie` (4),
`charcuterie` (1). Total 26, aucun `NULL`, aucun libellé en clair.

- [x] **Étape 7 : commit**

```bash
git add mobile/lib/rayons.ts mobile/lib/rayons.test.mjs supabase/migrations/0006_rayons_ingredients.sql
git commit -m "feat: un seul vocabulaire de rayons pour les ingrédients"
```

---

### Tâche 2 : conversion d'unités

**Fichiers :**
- Créer : `mobile/lib/unites.ts` (porté de `frontend/src/lib/unitConverter.js`)
- Test : `mobile/lib/unites.test.mjs`

**Interfaces :**
- Produit :
  - `normalizeUnit(unit: string | null | undefined): 'g' | 'ml' | 'unité' | null`
  - `convertToProductQty(qty: number, unit: string, product: ProduitMesure): { qty: number; approximate: boolean }`
  - `isConvertible(unit: string, product: ProduitMesure): boolean`
  - `formatIngredientQty(qty: number, unit: string): string`
  - `type ProduitMesure = { unit?: string | null; grammage_g?: number | null; volume_ml?: number | null }`

- [x] **Étape 1 : écrire le test qui échoue**

Créer `mobile/lib/unites.test.mjs` :

```js
/**
 * Conversion ingrédient → quantité de produit.
 * Lancer : node --test mobile/lib/unites.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUnit, convertToProductQty, isConvertible } from './unites.ts';

test('normalise les familles d\'unités', () => {
  assert.equal(normalizeUnit('g'), 'g');
  assert.equal(normalizeUnit('kg'), 'g');
  assert.equal(normalizeUnit('ml'), 'ml');
  assert.equal(normalizeUnit('L'), 'ml');
  assert.equal(normalizeUnit('gousse'), 'unité');
  assert.equal(normalizeUnit('cuillère à soupe'), 'unité');
  assert.equal(normalizeUnit('parsec'), null);
  assert.equal(normalizeUnit(''), null);
});

test('200 g de lardons dans un paquet de 200 g font un paquet', () => {
  const r = convertToProductQty(200, 'g', { unit: 'unité', grammage_g: 200 });
  assert.equal(r.qty, 1);
  assert.equal(r.approximate, true);
});

test('la quantité est arrondie au paquet supérieur, jamais en dessous', () => {
  // 250 g demandés dans des paquets de 200 g : deux paquets. En arrondir un
  // seul ferait manquer l'ingrédient.
  assert.equal(convertToProductQty(250, 'g', { unit: 'unité', grammage_g: 200 }).qty, 2);
});

test('les kilos et les litres sont ramenés avant division', () => {
  assert.equal(convertToProductQty(1, 'kg', { unit: 'unité', grammage_g: 500 }).qty, 2);
  assert.equal(convertToProductQty(1, 'L', { unit: 'unité', volume_ml: 250 }).qty, 4);
});

test('sans grammage connu, la conversion échoue au lieu de mentir', () => {
  // C'est ce cas que `missingGrammage` signale à l'écran : mieux vaut avouer
  // qu'on ne sait pas que de proposer une quantité inventée.
  const r = convertToProductQty(200, 'g', { unit: 'unité', grammage_g: null });
  assert.equal(r.qty, 0);
  assert.equal(r.approximate, true);
});

test('les unités dénombrables valent un pour un', () => {
  assert.equal(convertToProductQty(3, 'œufs', { unit: 'unité' }).qty, 3);
  assert.equal(convertToProductQty(2, 'gousse', { unit: 'unité' }).qty, 2);
});

test('une quantité nulle ou négative ne demande rien', () => {
  assert.equal(convertToProductQty(0, 'g', { unit: 'unité', grammage_g: 200 }).qty, 0);
  assert.equal(convertToProductQty(-5, 'g', { unit: 'unité', grammage_g: 200 }).qty, 0);
});

test('isConvertible distingue ce qui est mesurable de ce qui ne l\'est pas', () => {
  assert.equal(isConvertible('g', { unit: 'unité', grammage_g: 200 }), true);
  assert.equal(isConvertible('parsec', { unit: 'unité', grammage_g: 200 }), false);
});
```

- [x] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/unites.test.mjs
```

Attendu : ÉCHEC, `ERR_MODULE_NOT_FOUND` sur `./unites.ts`.

- [x] **Étape 3 : porter le module**

Copier `frontend/src/lib/unitConverter.js` vers `mobile/lib/unites.ts`, en
appliquant exactement ces transformations et **aucune autre** :

1. Ajouter en tête le type exporté :

```ts
export type ProduitMesure = {
  unit?: string | null;
  grammage_g?: number | null;
  volume_ml?: number | null;
};
```

2. Typer les signatures des quatre fonctions exportées :

```ts
export function normalizeUnit(unit: string | null | undefined): 'g' | 'ml' | 'unité' | null
export function convertToProductQty(
  ingredientQty: number,
  ingredientUnit: string,
  product: ProduitMesure,
): { qty: number; approximate: boolean }
export function isConvertible(ingredientUnit: string, product: ProduitMesure): boolean
export function formatIngredientQty(qty: number, unit: string): string
```

3. Typer les deux aides internes `_toGrams` et `_toMl` en
   `(qty: number, unit: string) => number | null`.

4. Typer les trois ensembles en `ReadonlySet<string>`.

**Ne pas retoucher la logique.** En particulier, garder les cas 2b et 3b qui
convertissent kg → g et L → ml avant la division, et l'arrondi `Math.ceil` : il
garantit qu'on n'achète jamais moins que nécessaire.

- [x] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
npx tsc --noEmit
```

Attendu : `# fail 0`, aucune erreur TypeScript.

- [x] **Étape 5 : commit**

```bash
git add mobile/lib/unites.ts mobile/lib/unites.test.mjs
git commit -m "feat: conversion d'unités portée sur mobile"
```

---

### Tâche 3 : consolidation de la liste

**Fichiers :**
- Créer : `mobile/lib/consolidation.ts` (porté de `frontend/src/stores/wizardStore.js:130-413`)
- Test : `mobile/lib/consolidation.test.mjs`

**Interfaces :**
- Consomme : `convertToProductQty`, `isConvertible`, `normalizeUnit` de `./unites.ts` ; `normalizeProductType` de `./typology.ts` ; `rayonDepuisLibelle`, `CleRayon` de `./rayons.ts`.
- Produit :
  - `getRecipeUsage(options): { totalQuantity: number; breakdown: Array<…>; approximate: boolean; missingGrammage: boolean; product: object | null }`
  - `buildConsolidatedItems(options): LigneConsolidee[]`
  - `groupByRayon(items: LigneConsolidee[]): Array<{ rayon: CleRayon; entries: LigneConsolidee[] }>`
  - `getRecipeIngredientMatches(options): GroupeIngredient[]`
  - `type LigneConsolidee = { key: string; name: string; unit: string; rayon: CleRayon; totalQuantity: number; ean13: string | null; sources: Array<{ type: string; label: string; qty: number }> }`

- [x] **Étape 1 : écrire le test qui échoue**

Créer `mobile/lib/consolidation.test.mjs` :

```js
/**
 * Consolidation de la liste de courses.
 * Lancer : node --test mobile/lib/consolidation.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConsolidatedItems, groupByRayon, getRecipeUsage, getRecipeIngredientMatches,
} from './consolidation.ts';

const RECETTES = [
  {
    id: 'r1', name: 'Carbonara',
    ingredients: [
      { name: 'Lardons fumés', quantity_per_serving: 50, unit: 'g', rayon: 'charcuterie' },
      { name: 'Spaghetti', quantity_per_serving: 100, unit: 'g', rayon: 'epicerie' },
    ],
  },
  {
    id: 'r2', name: 'Gratin',
    ingredients: [
      { name: 'Spaghetti', quantity_per_serving: 50, unit: 'g', rayon: 'epicerie' },
    ],
  },
];

test('deux recettes qui demandent le même ingrédient le fusionnent', () => {
  const items = buildConsolidatedItems({
    recipes: RECETTES,
    selectedRecipes: { r1: 4, r2: 2 },
    quotidien: {}, quotidienQty: {}, extras: [], products: [],
  });
  const spaghetti = items.find((i) => i.name === 'Spaghetti');
  // 100 × 4 parts + 50 × 2 parts
  assert.equal(spaghetti.totalQuantity, 500);
  assert.equal(spaghetti.sources.length, 2);
});

test('une recette non retenue n\'entre pas dans la liste', () => {
  const items = buildConsolidatedItems({
    recipes: RECETTES,
    selectedRecipes: { r1: 4 },
    quotidien: {}, quotidienQty: {}, extras: [], products: [],
  });
  assert.equal(items.find((i) => i.name === 'Lardons fumés').totalQuantity, 200);
  assert.equal(items.length, 2);
});

test('le rayon est toujours une clé canonique, jamais un libellé', () => {
  const items = buildConsolidatedItems({
    recipes: [{ id: 'r3', name: 'X', ingredients: [
      { name: 'Poulet', quantity_per_serving: 1, unit: 'kg', rayon: 'Boucherie' },
    ] }],
    selectedRecipes: { r3: 4 },
    quotidien: {}, quotidienQty: {}, extras: [], products: [],
  });
  assert.equal(items[0].rayon, 'pls');
});

test('les ajouts manuels rejoignent la liste', () => {
  const items = buildConsolidatedItems({
    recipes: [], selectedRecipes: {}, quotidien: {}, quotidienQty: {},
    extras: [{ id: 'e1', name: 'Piles AA', quantity: 1, unit: 'unité', rayon: 'maison' }],
    products: [],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].rayon, 'maison');
});

test('un produit du quotidien marqué « à acheter » entre avec sa quantité', () => {
  const items = buildConsolidatedItems({
    recipes: [], selectedRecipes: {},
    quotidien: { 'p1': 'needed' }, quotidienQty: { 'p1': 3 }, extras: [],
    products: [{ id: 'p1', name: 'Lait', unit: 'unité', category: 'pls', ean13: '123' }],
  });
  assert.equal(items[0].totalQuantity, 3);
  assert.equal(items[0].rayon, 'pls');
  assert.equal(items[0].ean13, '123');
});

test('un produit marqué « j\'en ai déjà » n\'entre pas', () => {
  const items = buildConsolidatedItems({
    recipes: [], selectedRecipes: {},
    quotidien: { 'p1': 'have' }, quotidienQty: {}, extras: [],
    products: [{ id: 'p1', name: 'Lait', unit: 'unité', category: 'pls' }],
  });
  assert.equal(items.length, 0);
});

test('groupByRayon suit l\'ordre du magasin, pas l\'alphabet', () => {
  const groupes = groupByRayon([
    { key: 'a', name: 'Sucre', unit: 'g', rayon: 'epicerie', totalQuantity: 1, ean13: null, sources: [] },
    { key: 'b', name: 'Lait', unit: 'unité', rayon: 'pls', totalQuantity: 1, ean13: null, sources: [] },
  ]);
  // pls (ordre 1) précède epicerie (ordre 4) : l'alphabet ferait l'inverse.
  assert.deepEqual(groupes.map((g) => g.rayon), ['pls', 'epicerie']);
});

test('getRecipeUsage totalise ce qu\'un produit doit couvrir', () => {
  const u = getRecipeUsage({
    productId: null,
    productName: 'Spaghetti',
    productUnit: 'unité',
    product: { name: 'Spaghetti n°5', unit: 'unité', grammage_g: 500 },
    selectedRecipes: { r1: 4, r2: 2 },
    recipes: RECETTES,
  });
  // 500 g au total, en paquets de 500 g : un paquet.
  assert.equal(u.totalQuantity, 1);
  assert.equal(u.breakdown.length, 2);
});

test('getRecipeIngredientMatches regroupe par type et propose les candidats', () => {
  const groupes = getRecipeIngredientMatches({
    selectedRecipes: { r1: 4 },
    recipes: RECETTES,
    products: [
      { id: 'p1', name: 'Lardons fumés CARREFOUR', product_type: 'lardon' },
      { id: 'p2', name: 'Allumettes de bacon', product_type: 'lardon' },
      { id: 'p3', name: 'Sucre en poudre', product_type: 'sucre' },
    ],
  });
  const lardons = groupes.find((g) => g.productType === 'lardon');
  assert.equal(lardons.matchingProducts.length, 2);
  assert.equal(lardons.totalQty, 200);
});
```

- [x] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/consolidation.test.mjs
```

Attendu : ÉCHEC, `ERR_MODULE_NOT_FOUND` sur `./consolidation.ts`.

- [x] **Étape 3 : porter le module**

Copier les lignes 130 à 413 de `frontend/src/stores/wizardStore.js` vers
`mobile/lib/consolidation.ts` — les quatre fonctions exportées et l'aide
`normalizeName`. Appliquer exactement ces transformations :

1. Imports en tête :

```ts
import { convertToProductQty, isConvertible, normalizeUnit, type ProduitMesure } from './unites.ts';
import { normalizeProductType } from './typology.ts';
import { rayonDepuisLibelle, RAYONS, type CleRayon } from './rayons.ts';
```

2. **`product_type` des ingrédients est calculé, pas lu.** Le backend le
   produisait par `normalize_product_type(self.name)` ; il n'existe dans aucune
   table. Partout où le code lit `ing.product_type`, le remplacer par :

```ts
const typeIngredient = ing.product_type ?? normalizeProductType(ing.name);
```

   et utiliser `typeIngredient` ensuite. Cela concerne `getRecipeUsage`
   (`matchByType`), `buildConsolidatedItems` (`coveredProductTypes`) et
   `getRecipeIngredientMatches` (`productType`).

3. **Le rayon passe par `rayonDepuisLibelle`.** Dans `buildConsolidatedItems`,
   la fonction `push` calcule aujourd'hui `rayon: entry.rayon || 'Divers'`. La
   remplacer par :

```ts
        rayon: rayonDepuisLibelle(entry.rayon ?? entry.category),
```

   Pour la branche `quotidien`, remplacer `rayon: p.rayon || p.category || 'Quotidien'`
   par `rayon: rayonDepuisLibelle(p.category)`. La colonne `products.category`
   porte désormais une clé canonique, que `rayonDepuisLibelle` rend telle quelle.

4. **Le champ `category` disparaît de la ligne consolidée.** Il doublonnait
   `rayon` ; un seul suffit désormais qu'ils parlent la même langue.

5. **`ean13` entre dans la ligne consolidée.** Dans `push`, ajouter
   `ean13: entry.ean13 ?? null`, et dans la branche `quotidien` passer
   `ean13: p.ean13 ?? null`. C'est ce champ qui rendra l'ajout certain chez
   Carrefour au lot 5.

6. **`groupByRayon` suit l'ordre du magasin.** Remplacer son corps par :

```ts
export function groupByRayon(
  items: LigneConsolidee[],
): Array<{ rayon: CleRayon; entries: LigneConsolidee[] }> {
  const map = new Map<CleRayon, LigneConsolidee[]>();
  items.forEach((item) => {
    if (!map.has(item.rayon)) map.set(item.rayon, []);
    map.get(item.rayon)!.push(item);
  });
  // L'ordre est celui du magasin (display_order), pas l'alphabet : le web
  // plaçait « Épicerie » avant « Fruits & légumes », ce qui fait traverser
  // le magasin deux fois.
  return RAYONS
    .filter((r) => map.has(r.cle))
    .map((r) => ({ rayon: r.cle, entries: map.get(r.cle)! }));
}
```

7. Retirer le tri par `rayon` de `buildConsolidatedItems` — `groupByRayon` s'en
   charge. Garder le tri par nom à l'intérieur d'un rayon.

8. Typer les paramètres et les retours conformément au bloc **Interfaces**
   ci-dessus.

- [x] **Étape 4 : lancer les tests et vérifier qu'ils passent**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
npx tsc --noEmit
```

Attendu : `# fail 0`, aucune erreur TypeScript.

- [x] **Étape 5 : commit**

```bash
git add mobile/lib/consolidation.ts mobile/lib/consolidation.test.mjs
git commit -m "feat: consolidation de la liste portée sur mobile"
```

---

## Phase 2 — Nutriscore

### Tâche 4 : le Nutriscore entre en base

**Fichiers :**
- Créer : `supabase/migrations/0007_nutriscore.sql`
- Modifier : `mobile/lib/openfoodfacts.ts`
- Modifier : `mobile/stores/products.ts`
- Test : `mobile/lib/openfoodfacts.test.mjs`

**Interfaces :**
- Produit : `FicheProduit` gagne `nutriscore: NoteNutri | null` ;
  `type NoteNutri = 'a' | 'b' | 'c' | 'd' | 'e'`.

- [x] **Étape 1 : écrire les tests qui échouent**

Ajouter à la fin de `mobile/lib/openfoodfacts.test.mjs` :

```js
test('la note Nutriscore est reprise et normalisée en minuscule', () => {
  const fiche = mapOffProduct('123', {
    product_name: 'Yaourt nature', nutriscore_grade: 'B',
  });
  assert.equal(fiche.nutriscore, 'b');
});

test('un produit non noté garde null, ce n\'est pas une erreur', () => {
  // Beaucoup de produits n'ont pas de Nutriscore : sel, café, épices.
  assert.equal(mapOffProduct('123', { product_name: 'Sel fin' }).nutriscore, null);
  assert.equal(
    mapOffProduct('123', { product_name: 'X', nutriscore_grade: 'unknown' }).nutriscore,
    null,
  );
  assert.equal(
    mapOffProduct('123', { product_name: 'X', nutriscore_grade: 'not-applicable' }).nutriscore,
    null,
  );
});
```

- [x] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/openfoodfacts.test.mjs
```

Attendu : ÉCHEC, `undefined !== 'b'`.

- [x] **Étape 3 : écrire la migration**

Créer `supabase/migrations/0007_nutriscore.sql` :

```sql
-- Note Nutriscore des produits, telle qu'Open Food Facts la publie.
--
-- NULL est une valeur légitime et fréquente : le sel, le café ou les épices
-- ne reçoivent pas de note. L'absence de note ne doit donc jamais se lire
-- comme une donnée manquante à corriger.

alter table public.products add column if not exists nutriscore text;

alter table public.products drop constraint if exists products_nutriscore_valide;
alter table public.products add constraint products_nutriscore_valide
  check (nutriscore is null or nutriscore in ('a', 'b', 'c', 'd', 'e'));

comment on column public.products.nutriscore is
  'Note Nutriscore a-e depuis Open Food Facts. NULL = produit non noté.';
```

Appliquer par l'outil MCP Supabase `apply_migration`, projet
`qmymwicsgilhoihtfdjm`, nom `nutriscore`.

- [x] **Étape 4 : écrire l'implémentation**

Dans `mobile/lib/openfoodfacts.ts` :

Ajouter le type et le champ :

```ts
export type NoteNutri = 'a' | 'b' | 'c' | 'd' | 'e';
```

Dans `FicheProduit`, après `categoryKey` :

```ts
  /** Note Open Food Facts. `null` est fréquent et légitime : sel, café, épices. */
  nutriscore: NoteNutri | null;
```

Dans `OffData`, ajouter `nutriscore_grade?: string;`.

Ajouter la fonction de lecture, avant `mapOffProduct` :

```ts
/**
 * Lit la note Nutriscore d'Open Food Facts.
 *
 * L'API renvoie aussi « unknown » et « not-applicable » pour les produits non
 * notés : les deux valent `null`, pas une note.
 */
function litNutriscore(brut: string | undefined): NoteNutri | null {
  const n = (brut ?? '').trim().toLowerCase();
  return ['a', 'b', 'c', 'd', 'e'].includes(n) ? (n as NoteNutri) : null;
}
```

Dans le retour de `mapOffProduct`, après `categoryKey` :

```ts
    nutriscore: litNutriscore(data.nutriscore_grade),
```

Ajouter le champ à la requête :

```ts
const CHAMPS = 'product_name,brands,image_url,product_quantity,categories_tags,nutriscore_grade';
```

Dans `mobile/stores/products.ts` :

Ajouter `nutriscore: string | null;` au type `Product`, et `nutriscore` à la
constante `CHAMPS`. Dans l'insertion, après `category`, ajouter :

```ts
    nutriscore: fiche.nutriscore ?? null,
```

Dans `mobile/app/(tabs)/scan.tsx`, ajouter `nutriscore: null` aux deux fiches
construites à la main — l'espace réservé hors ligne de `mettreEnAttente`, et
`ajouterManuel`.

- [x] **Étape 5 : lancer les tests et vérifier qu'ils passent**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
npx tsc --noEmit
```

Attendu : `# fail 0`, aucune erreur TypeScript.

- [x] **Étape 6 : commit**

```bash
git add mobile/lib/openfoodfacts.ts mobile/lib/openfoodfacts.test.mjs mobile/stores/products.ts "mobile/app/(tabs)/scan.tsx" supabase/migrations/0007_nutriscore.sql
git commit -m "feat: le Nutriscore accompagne les produits scannés"
```

---

### Tâche 5 : la pastille Nutriscore

**Fichiers :**
- Créer : `mobile/components/PastilleNutri.tsx`
- Modifier : `mobile/lib/theme.ts`
- Modifier : `mobile/components/ProductRow.tsx`
- Modifier : `mobile/components/FicheScannee.tsx`

**Interfaces :**
- Consomme : `NoteNutri` de `lib/openfoodfacts.ts`.
- Produit : `<PastilleNutri note={note} />` — rend `null` si `note` est `null`.

- [x] **Étape 1 : ajouter les couleurs au thème**

Dans `mobile/lib/theme.ts`, ajouter à l'objet `colors`, avant la fermeture :

```ts
  // Pastilles Nutriscore. Ces cinq couleurs étaient déjà spécifiées dans
  // DESIGN.md §1.2 bis depuis la conception initiale, sans jamais servir.
  nutriA: '#2E7D32',
  nutriB: '#76B028',
  nutriC: '#F5B700',
  nutriD: '#E67E22',
  nutriE: '#C62828',
```

- [x] **Étape 2 : écrire le composant**

Créer `mobile/components/PastilleNutri.tsx` :

```tsx
import { StyleSheet, Text, View } from 'react-native';
import type { NoteNutri } from '../lib/openfoodfacts.ts';
import { colors, radius } from '../lib/theme';

const TEINTES: Record<NoteNutri, string> = {
  a: colors.nutriA,
  b: colors.nutriB,
  c: colors.nutriC,
  d: colors.nutriD,
  e: colors.nutriE,
};

type Props = { note: string | null | undefined };

/**
 * Pastille Nutriscore. Rend `null` quand le produit n'est pas noté — beaucoup
 * ne le sont pas, et une pastille grise « inconnu » encombrerait la liste sans
 * rien apprendre.
 */
export function PastilleNutri({ note }: Props) {
  const n = (note ?? '').toLowerCase();
  const teinte = TEINTES[n as NoteNutri];
  if (!teinte) return null;
  return (
    <View style={[s.pastille, { backgroundColor: teinte }]}>
      <Text style={s.lettre}>{n.toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pastille: {
    width: 22, height: 22, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  lettre: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
```

- [x] **Étape 3 : l'afficher dans le catalogue et sur la fiche de scan**

Dans `mobile/components/ProductRow.tsx`, importer le composant et le placer à
la fin de la ligne, après le texte :

```tsx
import { PastilleNutri } from './PastilleNutri';
```

puis, dans le rendu, juste avant la balise fermante du conteneur de ligne :

```tsx
      <PastilleNutri note={produit.nutriscore} />
```

Dans `mobile/components/FicheScannee.tsx`, dans la branche « fiche trouvée »,
placer la pastille à côté du nom. Remplacer :

```tsx
              <Text style={s.nom} numberOfLines={2}>{fiche.name}</Text>
```

par :

```tsx
              <View style={s.ligneNom}>
                <Text style={[s.nom, s.nomFlex]} numberOfLines={2}>{fiche.name}</Text>
                <PastilleNutri note={fiche.nutriscore} />
              </View>
```

et ajouter les deux styles :

```tsx
  ligneNom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nomFlex: { flex: 1 },
```

sans oublier l'import :

```tsx
import { PastilleNutri } from './PastilleNutri';
```

- [x] **Étape 4 : vérifier la compilation**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
```

Attendu : aucune erreur, `# fail 0`.

- [x] **Étape 5 : commit**

```bash
git add mobile/components/PastilleNutri.tsx mobile/lib/theme.ts mobile/components/ProductRow.tsx mobile/components/FicheScannee.tsx
git commit -m "feat: pastille Nutriscore au catalogue et au scan"
```

---

### Tâche 6 : rattraper les 65 produits déjà en base

**Fichiers :**
- Créer : `mobile/scripts/rattrapage_nutriscore.mjs`

**Interfaces :**
- Consomme : l'API Open Food Facts et la clé publiable Supabase.
- Produit : un script à lancer une fois, non appelé par l'application.

- [x] **Étape 1 : écrire le script**

Créer `mobile/scripts/rattrapage_nutriscore.mjs` :

```js
/**
 * Renseigne le Nutriscore des produits déjà en base, une seule fois.
 *
 * Les 65 produits migrés ont tous un EAN13 mais ont été enregistrés avant que
 * l'application ne lise cette note. Le traitement est séquentiel, une seconde
 * entre deux appels : Open Food Facts est un service gratuit, et 65 requêtes
 * étalées sur une minute restent courtoises.
 *
 * Lancer (Node >= 22), depuis mobile/ :
 *   EXPO_PUBLIC_SUPABASE_URL=… EXPO_PUBLIC_SUPABASE_ANON_KEY=… \
 *   node scripts/rattrapage_nutriscore.mjs <jeton_de_session>
 *
 * Le jeton de session est nécessaire : RLS n'autorise l'écriture qu'au
 * propriétaire des lignes, et la clé publiable seule est anonyme.
 */
const URL_SB = process.env.EXPO_PUBLIC_SUPABASE_URL;
const CLE = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const JETON = process.argv[2];

if (!URL_SB || !CLE || !JETON) {
  console.error('Usage : EXPO_PUBLIC_SUPABASE_URL=… EXPO_PUBLIC_SUPABASE_ANON_KEY=… node scripts/rattrapage_nutriscore.mjs <jeton>');
  process.exit(2);
}

const entetes = {
  apikey: CLE,
  Authorization: `Bearer ${JETON}`,
  'Content-Type': 'application/json',
};

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const r = await fetch(
  `${URL_SB}/rest/v1/products?select=id,ean13,name&nutriscore=is.null&ean13=not.is.null`,
  { headers: entetes },
);
if (!r.ok) {
  console.error('Lecture impossible :', r.status, await r.text());
  process.exit(1);
}
const produits = await r.json();
console.log(`${produits.length} produits sans note`);

let notes = 0;
let sansNote = 0;
for (const [i, p] of produits.entries()) {
  try {
    const off = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${p.ean13}.json?fields=nutriscore_grade`,
      { headers: { 'User-Agent': 'courses-app/1.0 (rattrapage familial)' } },
    );
    const j = off.ok ? await off.json() : null;
    const brut = (j?.product?.nutriscore_grade ?? '').trim().toLowerCase();
    const note = ['a', 'b', 'c', 'd', 'e'].includes(brut) ? brut : null;

    if (note) {
      const maj = await fetch(`${URL_SB}/rest/v1/products?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: entetes,
        body: JSON.stringify({ nutriscore: note }),
      });
      if (maj.ok) {
        notes += 1;
        console.log(`[${i + 1}/${produits.length}] ${p.name} → ${note.toUpperCase()}`);
      } else {
        console.error(`[${i + 1}] échec écriture ${p.name} :`, maj.status);
      }
    } else {
      sansNote += 1;
      console.log(`[${i + 1}/${produits.length}] ${p.name} → non noté`);
    }
  } catch (e) {
    console.error(`[${i + 1}] ${p.name} :`, e.message);
  }
  await pause(1000);
}

console.log(`\nTerminé : ${notes} notés, ${sansNote} sans note.`);
```

- [x] **Étape 2 : vérifier la syntaxe sans exécuter**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --check scripts/rattrapage_nutriscore.mjs
```

Attendu : aucune sortie.

- [x] **Étape 3 : commit**

```bash
git add mobile/scripts/rattrapage_nutriscore.mjs
git commit -m "chore: script de rattrapage du Nutriscore des produits migrés"
```

**Note pour l'exécution :** ce script demande un jeton de session valide, qu'on
obtient en se connectant. Il sera lancé après la livraison, une seule fois, et
son résultat vérifié par :
`select nutriscore, count(*) from public.products group by nutriscore order by 1;`

---

## Phase 3 — Recettes

### Tâche 7 : lire et créer des recettes

**Fichiers :**
- Créer : `mobile/stores/recipes.ts`
- Test : `mobile/lib/recette-brouillon.test.mjs`
- Créer : `mobile/lib/recette-brouillon.ts`

**Interfaces :**
- Produit :
  - `type IngredientBrouillon = { name: string; quantity_per_serving: number; unit: string; rayon: CleRayon; product_id: string | null }` — dans `lib/recette-brouillon.ts`
  - `type Ingredient = IngredientBrouillon & { id: string }` — dans `stores/recipes.ts`, tel que relu depuis la base
  - `const UNITES: readonly string[]` — les huit unités du formulaire web
  - `type Recipe = { id: string; name: string; description: string | null; servings_default: number; image_url: string | null; ingredients: Ingredient[] }`
  - `useRecipes(): { recettes: Recipe[]; chargement: boolean; erreur: string | null; recharger: () => Promise<void> }`
  - `creerRecette(brouillon: Brouillon): Promise<{ ok: boolean; erreur?: string }>`
  - `type Brouillon = { name: string; servings_default: number; ingredients: Ingredient[] }`
  - `valideBrouillon(b: Brouillon): string | null` — message d'erreur français, ou `null` si valide
  - `rayonPropose(nom: string, produits: Array<{ product_type: string | null; category: string | null }>): CleRayon`

- [x] **Étape 1 : écrire les tests qui échouent**

Créer `mobile/lib/recette-brouillon.test.mjs` :

```js
/**
 * Validation d'un brouillon de recette et proposition de rayon.
 * Lancer : node --test mobile/lib/recette-brouillon.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valideBrouillon, rayonPropose } from './recette-brouillon.ts';

const OK = {
  name: 'Carbonara',
  servings_default: 4,
  ingredients: [
    { name: 'Lardons', quantity_per_serving: 50, unit: 'g', rayon: 'charcuterie', product_id: null },
  ],
};

test('un brouillon complet est accepté', () => {
  assert.equal(valideBrouillon(OK), null);
});

test('une recette sans nom est refusée', () => {
  assert.match(valideBrouillon({ ...OK, name: '   ' }), /nom/i);
});

test('une recette sans ingrédient est refusée', () => {
  // Une recette vide passerait la validation puis produirait une liste vide,
  // sans que rien n'explique pourquoi.
  assert.match(valideBrouillon({ ...OK, ingredients: [] }), /ingr/i);
});

test('un nombre de parts nul ou négatif est refusé', () => {
  assert.match(valideBrouillon({ ...OK, servings_default: 0 }), /parts?/i);
});

test('un ingrédient sans nom est refusé, en indiquant sa position', () => {
  const msg = valideBrouillon({
    ...OK,
    ingredients: [{ name: '', quantity_per_serving: 1, unit: 'g', rayon: 'epicerie', product_id: null }],
  });
  assert.match(msg, /1/);
});

test('les messages sont en français, jamais un code technique', () => {
  const msg = valideBrouillon({ ...OK, name: '' });
  assert.ok(!/error|invalid|required/i.test(msg), `message technique : ${msg}`);
});

test('le rayon proposé vient du produit du catalogue de même type', () => {
  const produits = [{ product_type: 'lardon', category: 'charcuterie' }];
  assert.equal(rayonPropose('Lardons fumés', produits), 'charcuterie');
});

test('sans produit correspondant, le rayon proposé est « autre »', () => {
  assert.equal(rayonPropose('Poudre de perlimpinpin', []), 'autre');
  assert.equal(rayonPropose('', []), 'autre');
});
```

- [x] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/recette-brouillon.test.mjs
```

Attendu : ÉCHEC, `ERR_MODULE_NOT_FOUND` sur `./recette-brouillon.ts`.

- [x] **Étape 3 : écrire la validation**

Créer `mobile/lib/recette-brouillon.ts` :

```ts
import { normalizeProductType } from './typology.ts';
import { rayonDepuisLibelle, type CleRayon } from './rayons.ts';

export type IngredientBrouillon = {
  name: string;
  quantity_per_serving: number;
  unit: string;
  rayon: CleRayon;
  product_id: string | null;
};

export type Brouillon = {
  name: string;
  servings_default: number;
  ingredients: IngredientBrouillon[];
};

/** Unités proposées, reprises du formulaire web. */
export const UNITES = [
  'unité', 'g', 'kg', 'ml', 'L',
  'pincée', 'cuillère à café', 'cuillère à soupe',
] as const;

/**
 * Valide un brouillon avant enregistrement.
 *
 * @returns un message en français, ou `null` si le brouillon est valide.
 */
export function valideBrouillon(b: Brouillon): string | null {
  if (!b.name?.trim()) return 'Donne un nom à ta recette.';
  if (!Number.isFinite(b.servings_default) || b.servings_default < 1) {
    return 'Le nombre de parts doit être au moins 1.';
  }
  if (!b.ingredients?.length) {
    // Sans ce garde-fou, la recette s'enregistre puis ne produit rien dans le
    // wizard, sans qu'aucun écran n'explique pourquoi.
    return 'Ajoute au moins un ingrédient.';
  }
  for (const [i, ing] of b.ingredients.entries()) {
    if (!ing.name?.trim()) return `L'ingrédient ${i + 1} n'a pas de nom.`;
    if (!Number.isFinite(ing.quantity_per_serving) || ing.quantity_per_serving < 0) {
      return `La quantité de l'ingrédient ${i + 1} est invalide.`;
    }
  }
  return null;
}

/**
 * Propose un rayon pour un ingrédient : on cherche un produit du catalogue de
 * même typologie et on reprend son rayon. Sans correspondance, « autre » —
 * jamais un champ vide, qui obligerait à choisir avant de pouvoir avancer.
 */
export function rayonPropose(
  nom: string,
  produits: Array<{ product_type: string | null; category: string | null }>,
): CleRayon {
  const type = normalizeProductType(nom);
  if (!type) return 'autre';
  const trouve = produits.find((p) => p.product_type === type);
  return trouve ? rayonDepuisLibelle(trouve.category) : 'autre';
}
```

- [x] **Étape 4 : écrire le magasin de recettes**

Créer `mobile/stores/recipes.ts`, en suivant le patron de `stores/products.ts`
— hook maison, compteur de génération contre les réponses obsolètes, message
français en cas d'échec :

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Brouillon } from '../lib/recette-brouillon.ts';
import type { CleRayon } from '../lib/rayons.ts';

const ERREUR_CHARGEMENT =
  'Impossible de charger tes recettes. Vérifie ta connexion et réessaie.';

export type Ingredient = {
  id: string;
  name: string;
  quantity_per_serving: number;
  unit: string;
  rayon: CleRayon;
  product_id: string | null;
};

export type Recipe = {
  id: string;
  name: string;
  description: string | null;
  servings_default: number;
  image_url: string | null;
  ingredients: Ingredient[];
};

const CHAMPS =
  'id, name, description, servings_default, image_url, '
  + 'recipe_ingredients(id, name, quantity_per_serving, unit, rayon, product_id)';

export function useRecipes() {
  const [recettes, setRecettes] = useState<Recipe[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  // Même garde-fou que dans stores/products.ts : une réponse lente ne doit
  // pas écraser une réponse plus récente.
  const generation = useRef(0);

  const recharger = useCallback(async () => {
    const appel = ++generation.current;
    setChargement(true);
    const { data, error } = await supabase.from('recipes').select(CHAMPS).order('name');
    if (appel !== generation.current) return;
    if (error) {
      console.error('[recettes]', error);
      setErreur(ERREUR_CHARGEMENT);
      setRecettes([]);
    } else {
      setErreur(null);
      setRecettes(
        (data ?? []).map((r: any) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          servings_default: r.servings_default,
          image_url: r.image_url,
          ingredients: r.recipe_ingredients ?? [],
        })),
      );
    }
    setChargement(false);
  }, []);

  useEffect(() => { recharger(); }, [recharger]);

  return { recettes, chargement, erreur, recharger };
}

/**
 * Enregistre une recette et ses ingrédients.
 *
 * Les deux insertions ne sont pas dans une transaction : PostgREST n'en expose
 * pas. Si la seconde échoue, la recette resterait sans ingrédient — on la
 * supprime alors explicitement, plutôt que de laisser une coquille vide que
 * rien ne signalerait.
 */
export async function creerRecette(
  b: Brouillon,
): Promise<{ ok: boolean; erreur?: string }> {
  const { data: user } = await supabase.auth.getUser();
  const userId = user?.user?.id;
  if (!userId) return { ok: false, erreur: 'Session expirée. Reconnecte-toi.' };

  const { data: recette, error } = await supabase
    .from('recipes')
    .insert({ name: b.name.trim(), servings_default: b.servings_default, user_id: userId })
    .select('id')
    .single();

  if (error || !recette) {
    console.error('[creerRecette]', error);
    return { ok: false, erreur: "Impossible d'enregistrer la recette pour le moment." };
  }

  const { error: err2 } = await supabase.from('recipe_ingredients').insert(
    b.ingredients.map((i) => ({
      recipe_id: recette.id,
      user_id: userId,
      name: i.name.trim(),
      quantity_per_serving: i.quantity_per_serving,
      unit: i.unit,
      rayon: i.rayon,
      product_id: i.product_id,
    })),
  );

  if (err2) {
    console.error('[creerRecette:ingredients]', err2);
    await supabase.from('recipes').delete().eq('id', recette.id);
    return { ok: false, erreur: "Impossible d'enregistrer les ingrédients." };
  }

  return { ok: true };
}
```

- [x] **Étape 5 : lancer les tests et vérifier qu'ils passent**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
npx tsc --noEmit
```

Attendu : `# fail 0`, aucune erreur TypeScript.

- [x] **Étape 6 : commit**

```bash
git add mobile/lib/recette-brouillon.ts mobile/lib/recette-brouillon.test.mjs mobile/stores/recipes.ts
git commit -m "feat: lecture et création de recettes"
```

---

### Tâche 8 : les écrans de recettes

**Fichiers :**
- Créer : `mobile/app/(tabs)/recettes/index.tsx`
- Créer : `mobile/app/(tabs)/recettes/nouvelle.tsx`
- Créer : `mobile/app/(tabs)/recettes/_layout.tsx`
- Modifier : `mobile/app/(tabs)/_layout.tsx`

**Interfaces :**
- Consomme : `useRecipes`, `creerRecette` de `stores/recipes.ts` ;
  `valideBrouillon`, `rayonPropose`, `UNITES` de `lib/recette-brouillon.ts` ;
  `SelecteurRayon` de `components/SelecteurRayon.tsx` ; `useProducts` de
  `stores/products.ts` ; `EtatVide` de `components/EtatVide.tsx`.

- [x] **Étape 1 : déclarer la pile de recettes**

Créer `mobile/app/(tabs)/recettes/_layout.tsx` :

```tsx
import { Stack } from 'expo-router';

export default function RecettesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [x] **Étape 2 : l'écran de liste**

Créer `mobile/app/(tabs)/recettes/index.tsx`. Il affiche la liste des recettes
avec leur nombre de parts et d'ingrédients, un bouton « Nouvelle recette » qui
mène à `/recettes/nouvelle`, et trois états distincts :

- **chargement** : `ActivityIndicator` teinté `colors.accent`
- **erreur** : le message de `useRecipes` et un bouton « Réessayer » appelant
  `recharger`
- **vide** : `<EtatVide>` avec le titre « Aucune recette » et le texte
  « Crée ta première recette : le wizard s'en servira pour composer ta liste. »

Comme pour le catalogue, recharger au retour sur l'écran :

```tsx
useFocusEffect(useCallback(() => { recharger(); }, [recharger]));
```

Sans cela, une recette créée n'apparaîtrait pas au retour — expo-router garde
les onglets montés, le piège déjà rencontré sur le scan.

- [x] **Étape 3 : le formulaire**

Créer `mobile/app/(tabs)/recettes/nouvelle.tsx`, modelé sur
`frontend/src/components/recipes/RecipeForm.jsx` :

- champs **Nom** et **Nombre de parts** ;
- une liste d'ingrédients, chacun avec **nom**, **quantité par part**, **unité**
  (parmi `UNITES`) et **rayon** ;
- le rayon est prérempli par `rayonPropose(nom, produits)` dès que le champ nom
  perd le focus, et reste modifiable par `<SelecteurRayon>` ;
- un bouton **Ajouter un ingrédient**, et une croix pour en retirer un ;
- à l'enregistrement : `valideBrouillon` d'abord, le message affiché tel quel en
  cas d'échec ; puis `creerRecette`, et `router.back()` en cas de succès.

Le bouton d'enregistrement est désactivé pendant l'appel, avec un
`ActivityIndicator` à la place du libellé — même patron que `app/login.tsx`.

- [x] **Étape 4 : ajouter l'onglet**

Dans `mobile/app/(tabs)/_layout.tsx`, insérer **avant** l'écran `index` :

```tsx
      <Tabs.Screen
        name="recettes"
        options={{
          title: 'Recettes',
          tabBarIcon: ({ color, size }) => <Feather name="book-open" color={color} size={size} />,
        }}
      />
```

- [x] **Étape 5 : vérifier**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
```

Attendu : aucune erreur, `# fail 0`.

- [x] **Étape 6 : commit**

```bash
git add "mobile/app/(tabs)/recettes" "mobile/app/(tabs)/_layout.tsx"
git commit -m "feat: écrans de consultation et de création de recettes"
```

---

## Phase 4 — Wizard

### Tâche 9 : la pile de cartes

**Fichiers :**
- Créer : `mobile/components/wizard/PileSwipe.tsx`

**Interfaces :**
- Produit : `<PileSwipe items onAccepter onRejeter rendreCarte etatVide getId />`
  - `items: T[]`
  - `onAccepter: (item: T) => void` — glissement vers la droite
  - `onRejeter: (item: T) => void` — glissement vers la gauche
  - `rendreCarte: (item: T) => ReactNode`
  - `etatVide: ReactNode`
  - `getId?: (item: T) => string`

- [ ] **Étape 1 : écrire le composant**

`frontend/src/components/ui/SwipeStack.jsx` n'est **pas portable** : il repose
sur les événements de pointeur du DOM et sur des transformations CSS. Le
comportement est repris, le code est réécrit.

Créer `mobile/components/wizard/PileSwipe.tsx` :

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { radius } from '../../lib/theme';

const SEUIL = 90;

type Props<T> = {
  items: T[];
  onAccepter: (item: T) => void;
  onRejeter: (item: T) => void;
  rendreCarte: (item: T) => ReactNode;
  etatVide: ReactNode;
  getId?: (item: T) => string;
};

/**
 * Pile de cartes à faire glisser. Droite pour retenir, gauche pour écarter.
 *
 * `PanResponder` du cœur de React Native plutôt que `react-native-reanimated` :
 * ajouter ce dernier imposerait un nouveau pod, donc un prebuild, alors que la
 * chaîne de compilation vient de se stabiliser. L'animation d'une carte à la
 * fois n'a pas besoin du fil d'interface dédié qu'apporte Reanimated.
 */
export function PileSwipe<T>({
  items, onAccepter, onRejeter, rendreCarte, etatVide, getId,
}: Props<T>) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const position = useRef(new Animated.ValueXY()).current;
  // Ref en plus de l'état : le PanResponder est créé une fois et capturerait
  // sinon l'index du premier rendu pour toute la vie du composant.
  const indexRef = useRef(0);
  indexRef.current = index;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const cle = items.map((i, n) => (getId ? getId(i) : String(n))).join('|');
  useEffect(() => {
    setIndex(0);
    position.setValue({ x: 0, y: 0 });
  }, [cle, position]);

  const sortir = (direction: 1 | -1) => {
    const item = itemsRef.current[indexRef.current];
    if (item === undefined) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(position, {
      toValue: { x: direction * width * 1.2, y: 0 },
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      setIndex((n) => n + 1);
      if (direction === 1) onAccepter(item);
      else onRejeter(item);
    });
  };

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6,
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > SEUIL) sortir(1);
        else if (g.dx < -SEUIL) sortir(-1);
        else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            friction: 6,
          }).start();
        }
      },
    }),
  ).current;

  if (index >= items.length) return <>{etatVide}</>;

  const rotation = position.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  return (
    <View style={s.zone}>
      {/* Les deux cartes suivantes, en retrait, donnent la profondeur de pile. */}
      {items.slice(index + 1, index + 3).reverse().map((item, n) => {
        const rang = 2 - n;
        return (
          <View
            key={getId ? getId(item) : `fond-${rang}`}
            style={[s.carte, { transform: [{ translateY: rang * 10 }, { scale: 1 - rang * 0.04 }] }]}
            pointerEvents="none"
          >
            {rendreCarte(item)}
          </View>
        );
      })}

      <Animated.View
        style={[
          s.carte,
          { transform: [{ translateX: position.x }, { translateY: Animated.multiply(position.y, 0.3) }, { rotate: rotation }] },
        ]}
        {...responder.panHandlers}
      >
        {rendreCarte(items[index])}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  zone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  carte: { position: 'absolute', left: 0, right: 0, borderRadius: radius.lg },
});
```

- [ ] **Étape 2 : vérifier la compilation**

```bash
npx tsc --noEmit
```

Attendu : aucune erreur.

- [ ] **Étape 3 : commit**

```bash
git add mobile/components/wizard/PileSwipe.tsx
git commit -m "feat: pile de cartes à faire glisser, en React Native"
```

---

### Tâche 10 : l'état et la coquille du wizard

**Fichiers :**
- Créer : `mobile/contexts/WizardContext.tsx`
- Créer : `mobile/app/(tabs)/wizard/_layout.tsx`
- Créer : `mobile/app/(tabs)/wizard/[etape].tsx`
- Créer : `mobile/app/(tabs)/wizard/index.tsx`
- Modifier : `mobile/app/(tabs)/_layout.tsx`

**Interfaces :**
- Produit :
  - `ETAPES: ReadonlyArray<{ cle: string; titre: string }>` — `recettes`, `quotidien`, `ingredients`, `recap`, `generation`
  - `useWizard(): { selectedRecipes: Record<string, number>; quotidien: Record<string, 'needed' | 'have'>; quotidienQty: Record<string, number>; extras: LigneExtra[]; choixProduits: Record<string, string>; drives: string[]; …actions }`
  - actions : `toggleRecette(id, partsParDefaut)`, `setParts(id, n)`, `marquerProduit(id, statut)`, `setQuantite(id, n)`, `ajouterExtra(e)`, `retirerExtra(id)`, `choisirProduit(cleGroupe, produitId)`, `basculerDrive(nom)`, `reinitialiser()`

- [ ] **Étape 1 : écrire le contexte**

Créer `mobile/contexts/WizardContext.tsx`. L'état reprend `INITIAL` de
`frontend/src/stores/wizardStore.js:14-22`, augmenté de `choixProduits` — la
mémoire de l'étape 3, absente du web où le choix n'était pas conservé entre
deux passages.

Le contexte expose l'état et les actions, sans logique métier : la consolidation
vit dans `lib/consolidation.ts`, testée à part.

Un `WizardProvider` enveloppe la pile du wizard. Les actions sont mémoïsées par
`useCallback`, et la valeur du contexte par `useMemo`, pour ne pas rendre les
cinq étapes à chaque frappe.

- [ ] **Étape 2 : la coquille**

Créer `mobile/app/(tabs)/wizard/_layout.tsx` qui monte `<WizardProvider>` autour
d'un `<Stack screenOptions={{ headerShown: false }} />`.

Créer `mobile/app/(tabs)/wizard/index.tsx` qui redirige vers la première étape :

```tsx
import { Redirect } from 'expo-router';

export default function WizardIndex() {
  return <Redirect href="/wizard/recettes" />;
}
```

Créer `mobile/app/(tabs)/wizard/[etape].tsx` : la barre de progression en
segments, le titre de l'étape, une croix pour quitter, et le bouton d'action en
bas. L'aiguillage vers le composant d'étape se fait sur `useLocalSearchParams`.

Une étape inconnue redirige vers `recettes` — l'équivalent du garde-fou de
`WizardPage.jsx:39-41`.

Le bouton d'action reprend les conditions d'affichage de `WizardPage.jsx:64-78` :

| Étape | Bouton visible si |
|---|---|
| `recettes` | toujours |
| `quotidien` | au moins un produit marqué « à acheter », ou un ajout manuel |
| `ingredients` | toujours |
| `recap` | la liste consolidée n'est pas vide |
| `generation` | au moins un drive retenu |

- [ ] **Étape 3 : ajouter l'onglet**

Dans `mobile/app/(tabs)/_layout.tsx`, insérer entre `recettes` et `scan` :

```tsx
      <Tabs.Screen
        name="wizard"
        options={{
          title: 'Wizard',
          tabBarIcon: ({ color, size }) => <Feather name="list" color={color} size={size} />,
        }}
      />
```

L'ordre final de la barre est : Recettes · Wizard · Scan · Produits · Compte.

- [ ] **Étape 4 : vérifier**

```bash
npx tsc --noEmit
```

Attendu : des erreurs sur les cinq composants d'étape, qui n'existent pas
encore. Les créer en coquilles vides rendant `null` pour lever le blocage, les
tâches 11 à 13 les remplissent.

- [ ] **Étape 5 : commit**

```bash
git add mobile/contexts/WizardContext.tsx "mobile/app/(tabs)/wizard" "mobile/app/(tabs)/_layout.tsx"
git commit -m "feat: état partagé et coquille du wizard"
```

---

### Tâche 11 : étapes « recettes » et « quotidien »

**Fichiers :**
- Créer : `mobile/components/wizard/EtapeRecettes.tsx`
- Créer : `mobile/components/wizard/EtapeQuotidien.tsx`

**Interfaces :**
- Consomme : `PileSwipe`, `useWizard`, `useRecipes`, `useProducts`, `PastilleNutri`.

- [ ] **Étape 1 : l'étape recettes**

`EtapeRecettes.tsx` affiche les recettes en pile de cartes : image si elle
existe, nom, nombre d'ingrédients, nombre de parts.

Glisser à droite retient la recette avec son `servings_default` ; glisser à
gauche l'écarte. Sous la pile, les recettes retenues apparaissent en liste, avec
un réglage du nombre de parts par `−` et `+`.

L'état vide, une fois la pile épuisée : « Tu as vu toutes tes recettes. »

Si le catalogue de recettes est vide, afficher plutôt un `<EtatVide>` renvoyant
vers l'onglet Recettes — sans recette, le wizard n'a rien à consolider.

- [ ] **Étape 2 : l'étape quotidien**

`EtapeQuotidien.tsx` reprend le même patron avec les produits marqués
`favorite`. La carte porte le nom, la marque, l'image et la pastille Nutriscore.

Glisser à droite marque `needed` — « il m'en faut » ; à gauche, `have` — « j'en
ai déjà ». Les produits retenus apparaissent en dessous, avec leur quantité
réglable.

Un champ en bas permet d'ajouter un article libre, qui alimente `extras`.

- [ ] **Étape 3 : vérifier**

```bash
npx tsc --noEmit
```

Attendu : aucune erreur sur ces deux fichiers.

- [ ] **Étape 4 : commit**

```bash
git add mobile/components/wizard/EtapeRecettes.tsx mobile/components/wizard/EtapeQuotidien.tsx
git commit -m "feat: étapes recettes et quotidien du wizard"
```

---

### Tâche 12 : étape « ingrédients »

**Fichiers :**
- Créer : `mobile/components/wizard/EtapeIngredients.tsx`

**Interfaces :**
- Consomme : `getRecipeIngredientMatches` de `lib/consolidation.ts` ;
  `useWizard`, `useRecipes`, `useProducts`.

- [ ] **Étape 1 : écrire l'étape**

Pour chaque groupe rendu par `getRecipeIngredientMatches`, une carte affichant :

- le nom de l'ingrédient et la quantité totale, avec son unité ;
- les recettes qui le demandent, en petit — reprises de `group.sources` ;
- le produit retenu, et les autres candidats de même `product_type`.

Le produit retenu par défaut est le premier de `matchingProducts` ; le choix de
l'utilisateur est enregistré dans `choixProduits[group.key]` et prime.

Trois cas doivent se distinguer à l'écran :

1. **un seul candidat** — affiché, sans invitation à choisir ;
2. **plusieurs candidats** — le retenu est marqué, les autres se choisissent
   d'un tap ;
3. **aucun candidat** — le message « Aucun produit de ton catalogue ne
   correspond. Il partira sous son nom générique. » Ce cas doit se voir : c'est
   celui où l'extension devra deviner, avec le risque d'ambiguïté connu.

- [ ] **Étape 2 : vérifier**

```bash
npx tsc --noEmit
```

Attendu : aucune erreur.

- [ ] **Étape 3 : commit**

```bash
git add mobile/components/wizard/EtapeIngredients.tsx
git commit -m "feat: étape de rapprochement ingrédient et produit"
```

---

### Tâche 13 : étapes « récap » et « génération »

**Fichiers :**
- Créer : `mobile/components/wizard/EtapeRecap.tsx`
- Créer : `mobile/components/wizard/EtapeGeneration.tsx`
- Créer : `mobile/lib/cart-jobs.ts`
- Test : `mobile/lib/cart-jobs.test.mjs`

**Interfaces :**
- Produit :
  - `construireItems(lignes: LigneConsolidee[]): ItemPanier[]`
  - `type ItemPanier = { name: string; quantity: number; unit: string; ean13: string | null; category: CleRayon }`
  - `envoyerListe(items: ItemPanier[], drives: string[]): Promise<{ ok: boolean; erreur?: string }>`

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `mobile/lib/cart-jobs.test.mjs` :

```js
/**
 * Mise en forme de la liste destinée à cart_jobs.
 * Lancer : node --test mobile/lib/cart-jobs.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construireItems } from './cart-jobs.ts';

test('chaque ligne consolidée devient un article de panier', () => {
  const items = construireItems([
    { key: 'a', name: 'Lardons', unit: 'g', rayon: 'charcuterie',
      totalQuantity: 200, ean13: '3760040427577', sources: [] },
  ]);
  assert.deepEqual(items, [{
    name: 'Lardons', quantity: 200, unit: 'g',
    ean13: '3760040427577', category: 'charcuterie',
  }]);
});

test('un article sans code-barres part quand même, avec ean13 à null', () => {
  // C'est le cas des ajouts manuels : l'extension retombera sur la recherche
  // par nom, avec son score et sa détection d'ambiguïté.
  const items = construireItems([
    { key: 'b', name: 'Piles AA', unit: 'unité', rayon: 'maison',
      totalQuantity: 1, ean13: null, sources: [] },
  ]);
  assert.equal(items[0].ean13, null);
});

test('une liste vide ne produit aucun article', () => {
  assert.deepEqual(construireItems([]), []);
});
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/cart-jobs.test.mjs
```

Attendu : ÉCHEC, `ERR_MODULE_NOT_FOUND` sur `./cart-jobs.ts`.

- [ ] **Étape 3 : écrire le module**

Créer `mobile/lib/cart-jobs.ts` :

```ts
import { supabase } from './supabase';
import type { LigneConsolidee } from './consolidation.ts';
import type { CleRayon } from './rayons.ts';

export type ItemPanier = {
  name: string;
  quantity: number;
  unit: string;
  ean13: string | null;
  category: CleRayon;
};

/**
 * Met la liste consolidée à la forme attendue dans `cart_jobs.items`.
 *
 * `ean13` est conservé même quand il est absent : c'est lui qui rendra l'ajout
 * certain chez Carrefour au lot 5, dont les fiches produit exposent le
 * code-barres dans leur adresse. Sans lui, l'extension retombe sur la
 * recherche par nom et son risque d'ambiguïté.
 */
export function construireItems(lignes: LigneConsolidee[]): ItemPanier[] {
  return lignes.map((l) => ({
    name: l.name,
    quantity: l.totalQuantity,
    unit: l.unit,
    ean13: l.ean13 ?? null,
    category: l.rayon,
  }));
}

/**
 * Dépose la liste dans `cart_jobs`, à l'état `pending`.
 *
 * Rien ne lit cette table aujourd'hui : l'extension ne saura la relever qu'au
 * lot 5. C'est un choix assumé — voir la spécification du 22/08, « L'angle
 * mort assumé ».
 */
export async function envoyerListe(
  items: ItemPanier[],
  drives: string[],
): Promise<{ ok: boolean; erreur?: string }> {
  const { data: user } = await supabase.auth.getUser();
  const userId = user?.user?.id;
  if (!userId) return { ok: false, erreur: 'Session expirée. Reconnecte-toi.' };

  const { error } = await supabase.from('cart_jobs').insert({
    user_id: userId,
    status: 'pending',
    drives,
    items,
  });

  if (error) {
    console.error('[envoyerListe]', error);
    return { ok: false, erreur: "Impossible d'envoyer la liste pour le moment." };
  }
  return { ok: true };
}
```

- [ ] **Étape 4 : écrire les deux étapes**

`EtapeRecap.tsx` : appelle `buildConsolidatedItems` puis `groupByRayon`, et
affiche un en-tête par rayon — le **libellé**, jamais la clé — suivi de ses
lignes. Chaque ligne montre le nom, la quantité et son origine (« Carbonara »,
« Quotidien », « Ajout manuel »).

Une ligne dont la conversion a échoué faute de grammage porte la mention
« quantité à vérifier », dans le ton d'alerte du thème. Il ne faut pas qu'une
quantité incalculable se lise comme une quantité juste.

`EtapeGeneration.tsx` : les deux drives sous forme de cartes à cocher —
Carrefour et E.Leclerc — et le résumé du nombre d'articles. Le bouton d'action
de la coquille appelle `construireItems` puis `envoyerListe`.

En cas de succès, un écran de confirmation qui dit la vérité :

> Liste envoyée. Elle attend d'être reprise par l'extension sur ton Mac.

Ne pas promettre que le panier va se remplir : rien ne lira cette liste avant le
lot 5.

- [ ] **Étape 5 : vérifier**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
```

Attendu : aucune erreur, `# fail 0`.

- [ ] **Étape 6 : commit**

```bash
git add mobile/lib/cart-jobs.ts mobile/lib/cart-jobs.test.mjs mobile/components/wizard/EtapeRecap.tsx mobile/components/wizard/EtapeGeneration.tsx
git commit -m "feat: récapitulatif et envoi de la liste vers cart_jobs"
```

---

### Tâche 14 : livrer

**Fichiers :**
- Modifier : `mobile/app.json` si nécessaire

- [ ] **Étape 1 : vérification complète**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
npx expo-doctor
```

Attendu : aucune erreur TypeScript, `# fail 0`, et expo-doctor sans échec autre
que les deux connus — la version de CocoaPods locale et l'avertissement CNG,
tous deux sans effet sur Xcode Cloud.

- [ ] **Étape 2 : vérifier le bundle, comme le fera la CI**

```bash
EXPO_PUBLIC_SUPABASE_URL="https://qmymwicsgilhoihtfdjm.supabase.co" \
EXPO_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_PueJWmalqhZO0ctPu95GKQ_EaAgVulr" \
npx expo export --platform ios --output-dir /tmp/export-lot4
```

Attendu : `Exported:` sans erreur. C'est la même étape que la phase de bundle
d'Xcode Cloud : la faire échouer ici coûte une minute, l'y faire échouer coûte
vingt-cinq.

- [ ] **Étape 3 : ne pas toucher au numéro de build**

Xcode Cloud impose son propre numéro, repris de celui de l'exécution : le build
run n°3 a produit le build 3 alors que `CFBundleVersion` valait 2. Ni `app.json`
ni `Info.plist` ne sont à modifier.

- [ ] **Étape 4 : commit et poussée**

```bash
git push origin mobile/expo-scan
```

La poussée déclenche Xcode Cloud. Compter vingt à trente minutes.

- [ ] **Étape 5 : suivre le build sans demander à Angelo**

L'accès à l'API App Store Connect est en place. Depuis le répertoire de travail
de la session, avec `asc.mjs` :

```bash
ASC_KEY_ID=AYC86383MB \
ASC_ISSUER_ID=a725aaeb-78b3-44bb-80ee-018ca724ba5f \
ASC_KEY_PATH="$HOME/.appstoreconnect/AuthKey_AYC86383MB.p8" \
node asc.mjs "/v1/ciProducts/4ece9928-69b5-4a0a-a0cc-bdd408d09a57/buildRuns?limit=3"
```

En cas d'échec, récupérer les anomalies de l'action fautive puis son artefact de
journal — c'est ainsi que la coupure réseau sur hermes-engine a été identifiée.

- [ ] **Étape 6 : rattraper le Nutriscore**

Une fois la version installée et la session ouverte, lancer une seule fois le
script de la tâche 6, puis vérifier :

```sql
select nutriscore, count(*) from public.products group by nutriscore order by 1;
```

- [ ] **Étape 7 : vérification sur l'appareil**

1. L'onglet **Recettes** affiche les 5 recettes migrées.
2. Créer une recette à deux ingrédients : elle apparaît dans la liste.
3. Le **wizard** enchaîne les cinq étapes sans blocage.
4. Le récapitulatif groupe par rayon, **libellés en clair**, dans l'ordre du
   magasin.
5. La génération confirme l'envoi ; vérifier en base :
   `select status, drives, jsonb_array_length(items) from public.cart_jobs order by created_at desc limit 1;`
6. Les pastilles Nutriscore apparaissent au catalogue et au scan.

## Ce que ce plan ne fait pas

- L'import de recettes depuis un site web, la lecture du presse-papiers, le scan
  d'une fiche par OCR, l'extension de partage iOS.
- L'édition et la suppression de recettes.
- Le lot 5 — pont entre l'extension et `cart_jobs` — et le lot 6.
