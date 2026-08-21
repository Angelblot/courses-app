# Rayon, typologie et récupération de mot de passe — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour dérouler ce plan tâche par tâche. Les étapes
> emploient la syntaxe à cases (`- [ ]`) pour le suivi.

**But :** corriger les trois défauts relevés le 21/08 à la première utilisation
réelle sur iPhone — rayon absent sur les produits scannés, typologie qui retient
l'arôme au lieu de la nature, et absence de porte de secours quand le mot de passe
est oublié — puis livrer une nouvelle version par TestFlight.

**Architecture :** `categories_tags` d'Open Food Facts est déjà récupéré par
`lib/openfoodfacts.ts` puis jeté. Deux fonctions pures nouvelles l'exploitent —
l'une pour le rayon, l'autre pour la typologie — et le reste n'est que
propagation. La récupération de mot de passe passe par le flux PKCE et un lien
profond `coursesapp://reinitialisation`.

**Pile :** Expo SDK 57, React Native 0.86, expo-router, TypeScript, Supabase JS
2.112, `node:test`.

**Spécification :** `docs/superpowers/specs/2026-08-21-rayon-typologie-recuperation-design.md`

## Contraintes globales

- **Tests :** exigent Node ≥ 22. La version par défaut de la machine est la 20,
  qui ne sait pas charger un `.ts`. Commande de référence, vérifiée le 21/08
  (30 tests, 30 passés) :
  `/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs`
  Depuis `mobile/`. Aucun drapeau n'est nécessaire : le dépouillement de types est
  actif par défaut en 22.23.
- **Zéro emoji dans l'interface.** Jamais, nulle part.
- **Thème clair uniquement.** Toute couleur, tout espacement et tout arrondi
  viennent de `lib/theme.ts` — jamais de valeur littérale.
- **Messages d'erreur en français**, jamais `error.message` brut à l'écran. Le
  détail technique part à `console.error`, comme dans `app/login.tsx:50`.
- **TypeScript :** 2 espaces, composants fonctionnels, camelCase, PascalCase pour
  les composants.
- **Imports internes en `.ts` explicite** (`from './rayons.ts'`), convention déjà
  en vigueur dans `lib/` et `stores/`.
- **Ne rien pousser avant la tâche 7.** Xcode Cloud surveille `mobile/` sur la
  branche `mobile/expo-scan` avec « Auto-cancel Builds » actif : chaque poussée
  déclenche un build et annule le précédent. Les commits restent locaux.
- **Branche :** `mobile/expo-scan`. Commits en français, préfixés `feat:`, `fix:`
  ou `chore:`.

---

### Tâche 1 : déduction du rayon depuis Open Food Facts

**Fichiers :**
- Créer : `mobile/lib/rayons.ts`
- Test : `mobile/lib/rayons.test.mjs`

**Interfaces :**
- Consomme : rien.
- Produit :
  - `type CleRayon = 'fruits_legumes' | 'pls' | 'charcuterie' | 'boissons' | 'epicerie' | 'droguerie' | 'parfumerie' | 'maison' | 'surgeles' | 'autre'`
  - `const RAYONS: ReadonlyArray<{ cle: CleRayon; label: string }>`
  - `function rayonDepuisCategories(tags: string[] | null | undefined): CleRayon`
  - `function libelleRayon(cle: string | null | undefined): string`

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `mobile/lib/rayons.test.mjs` :

```js
/**
 * Déduction du rayon depuis les catégories Open Food Facts.
 * Lancer : node --test mobile/lib/rayons.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rayonDepuisCategories, libelleRayon, RAYONS } from './rayons.ts';

// Étiquettes relevées sur l'API le 21/08/2026 pour les deux produits scannés.
const BOURSIN = [
  'en:dairies', 'en:fermented-foods', 'en:fermented-milk-products',
  'en:cheeses', 'en:cheeses-perishable',
];
const MENTHE = [
  'en:beverages-and-beverages-preparations', 'en:beverages',
  'en:beverage-preparations', 'en:syrups', 'en:flavoured-syrups', 'en:mint-syrups',
];

test('les deux produits scannés le 21/08 tombent dans le bon rayon', () => {
  assert.equal(rayonDepuisCategories(BOURSIN), 'pls');
  assert.equal(rayonDepuisCategories(MENTHE), 'boissons');
});

test('les surgelés l\'emportent sur le contenu du paquet', () => {
  // Une pizza surgelée porte les deux étiquettes. Le rayon est un emplacement
  // physique : c'est le congélateur qui décide où on ira la chercher, pas la
  // pâte. Lire « l'étiquette la plus précise » l'enverrait en épicerie.
  assert.equal(rayonDepuisCategories(['en:pizzas', 'en:frozen-foods']), 'surgeles');
  assert.equal(rayonDepuisCategories(['en:ice-cream', 'en:desserts']), 'surgeles');
});

test('sans étiquette exploitable, le rayon est « autre »', () => {
  assert.equal(rayonDepuisCategories([]), 'autre');
  assert.equal(rayonDepuisCategories(undefined), 'autre');
  assert.equal(rayonDepuisCategories(null), 'autre');
});

test('des étiquettes sans correspondance tombent en épicerie', () => {
  // Open Food Facts ne référence que l'alimentaire : si on a des étiquettes
  // mais qu'aucune ne correspond, c'est un produit d'épicerie.
  assert.equal(rayonDepuisCategories(['en:snacks', 'en:sweet-snacks', 'en:biscuits']), 'epicerie');
});

test('les œufs suivent le rayon Carrefour, pas la convention', () => {
  // « Œufs Plein Air » est rangé en CHARCUT.TRAITEUR dans les 65 produits
  // migrés. Le rayon sert à retrouver le produit dans le drive : on suit le
  // magasin, pas un manuel de nutrition.
  assert.equal(rayonDepuisCategories(['en:eggs']), 'charcuterie');
});

test('libelleRayon rend un libellé affichable, jamais une clé', () => {
  assert.equal(libelleRayon('pls'), 'Produits laitiers');
  assert.equal(libelleRayon('boissons'), 'Boissons');
  assert.equal(libelleRayon('cle_inexistante'), 'Autres');
  assert.equal(libelleRayon(null), 'Autres');
  assert.equal(libelleRayon(undefined), 'Autres');
});

test('les 10 rayons suivent l\'ordre d\'affichage de la base', () => {
  assert.deepEqual(RAYONS.map((r) => r.cle), [
    'fruits_legumes', 'pls', 'charcuterie', 'boissons', 'epicerie',
    'droguerie', 'parfumerie', 'maison', 'surgeles', 'autre',
  ]);
});
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Depuis `mobile/` :

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/rayons.test.mjs
```

Attendu : ÉCHEC, `ERR_MODULE_NOT_FOUND` sur `./rayons.ts`.

- [ ] **Étape 3 : écrire l'implémentation**

Créer `mobile/lib/rayons.ts` :

```ts
/**
 * Rayons du magasin, et déduction du rayon depuis les catégories Open Food Facts.
 *
 * Les 10 rayons reprennent la table `categories` de Supabase : mêmes clés, mêmes
 * libellés, même ordre d'affichage. La clé est ce qui est stocké dans
 * `products.category` ; le libellé est ce qui s'affiche.
 */

export type CleRayon =
  | 'fruits_legumes' | 'pls' | 'charcuterie' | 'boissons' | 'epicerie'
  | 'droguerie' | 'parfumerie' | 'maison' | 'surgeles' | 'autre';

/** Ordre repris de `categories.display_order` en base. */
export const RAYONS: ReadonlyArray<{ cle: CleRayon; label: string }> = [
  { cle: 'fruits_legumes', label: 'Fruits & légumes' },
  { cle: 'pls', label: 'Produits laitiers' },
  { cle: 'charcuterie', label: 'Charcuterie & traiteur' },
  { cle: 'boissons', label: 'Boissons' },
  { cle: 'epicerie', label: 'Épicerie' },
  { cle: 'droguerie', label: 'Droguerie' },
  { cle: 'parfumerie', label: 'Hygiène' },
  { cle: 'maison', label: 'Maison' },
  { cle: 'surgeles', label: 'Surgelés' },
  { cle: 'autre', label: 'Autres' },
];

/**
 * (rayon, fragments d'étiquette Open Food Facts).
 *
 * L'ordre est une PRIORITÉ DE RAYON, et non une spécificité d'étiquette. Une
 * pizza surgelée porte `en:frozen-foods` et `en:pizzas` : retenir l'étiquette la
 * plus précise l'enverrait en épicerie, alors qu'on ira la chercher au
 * congélateur. Le rayon décrit un emplacement physique dans le magasin.
 *
 * La comparaison est un `includes` sur l'étiquette entière, ce qui fait que
 * `en:mint-syrups` correspond à `syrups` et `en:cheeses-perishable` à `cheeses`.
 */
const PRIORITE: ReadonlyArray<readonly [CleRayon, readonly string[]]> = [
  // En tête : le congélateur l'emporte sur ce que contient le paquet.
  ['surgeles', ['frozen-foods', 'frozen-desserts', 'ice-cream']],
  ['boissons', ['beverages', 'waters', 'juices', 'syrups', 'sodas', 'beers', 'wines', 'alcoholic']],
  // `eggs` est ici et non dans `pls` : Carrefour range les œufs en
  // CHARCUT.TRAITEUR, et c'est là que l'utilisateur ira les chercher.
  ['charcuterie', ['charcuteries', 'hams', 'sausages', 'prepared-meats', 'delicatessen', 'eggs']],
  ['pls', ['dairies', 'cheeses', 'yogurts', 'milks', 'butters']],
  ['fruits_legumes', ['fresh-vegetables', 'fresh-fruits']],
];

/** Déduit le rayon d'un produit depuis ses catégories Open Food Facts. */
export function rayonDepuisCategories(tags: string[] | null | undefined): CleRayon {
  if (!tags?.length) return 'autre';
  for (const [rayon, fragments] of PRIORITE) {
    if (tags.some((t) => fragments.some((f) => t.includes(f)))) return rayon;
  }
  // Des étiquettes existent mais aucune ne correspond. Open Food Facts ne
  // référence que l'alimentaire : c'est donc de l'épicerie, pas « autre ».
  return 'epicerie';
}

/** Libellé affichable d'une clé de rayon. Toute clé inconnue rend « Autres ». */
export function libelleRayon(cle: string | null | undefined): string {
  return RAYONS.find((r) => r.cle === cle)?.label ?? 'Autres';
}
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/rayons.test.mjs
```

Attendu : `# pass 7`, `# fail 0`.

- [ ] **Étape 5 : commit**

```bash
git add mobile/lib/rayons.ts mobile/lib/rayons.test.mjs
git commit -m "feat: déduction du rayon depuis les catégories Open Food Facts"
```

---

### Tâche 2 : la typologie consulte les catégories avant le nom

**Fichiers :**
- Modifier : `mobile/lib/typology.ts` (ajout d'une table, signature de `normalizeProductType`)
- Test : `mobile/lib/typology.test.mjs` (ajouts en fin de fichier)

**Interfaces :**
- Consomme : rien de la tâche 1.
- Produit : `normalizeProductType(name: string | null | undefined, categories?: string[] | null): string | null`
  — le second paramètre est optionnel, tous les appels existants restent valides.

- [ ] **Étape 1 : écrire les tests qui échouent**

Ajouter à la fin de `mobile/lib/typology.test.mjs` :

```js
test('la catégorie prime sur le nom : le Boursin est un fromage', () => {
  // Sans catégorie, la règle `' ail '` attrape « Ail & Fines Herbes » et la
  // règle `fromage` ne se déclenche pas, le mot n'étant pas dans le nom.
  assert.equal(
    normalizeProductType(
      'Boursin® Onctueux Ail & Fines Herbes',
      ['en:dairies', 'en:fermented-milk-products', 'en:cheeses', 'en:cheeses-perishable'],
    ),
    'fromage',
  );
});

test('la Menthe Verte de Teisseire est un sirop', () => {
  assert.equal(
    normalizeProductType('Menthe Verte', ['en:beverages', 'en:syrups', 'en:mint-syrups']),
    'sirop',
  );
});

test('sans catégorie, les règles par nom sont inchangées', () => {
  // Documente la limite assumée : le nom seul ne peut pas savoir qu'un Boursin
  // est un fromage. C'est précisément pourquoi les catégories passent devant.
  assert.equal(normalizeProductType('Boursin® Onctueux Ail & Fines Herbes'), 'ail');
  assert.equal(normalizeProductType('Lardons fumés Herta'), 'lardon');
  assert.equal(normalizeProductType('Spaghetti Barilla 500g'), 'pate');
});

test('une catégorie sans correspondance laisse la main aux règles par nom', () => {
  assert.equal(
    normalizeProductType('Lardons fumés Herta', ['en:snacks', 'en:sweet-snacks']),
    'lardon',
  );
});

test('une catégorie suffit même sans nom exploitable', () => {
  assert.equal(normalizeProductType('', ['en:cheeses']), 'fromage');
  assert.equal(normalizeProductType(null, ['en:cheeses']), 'fromage');
});
```

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/typology.test.mjs
```

Attendu : ÉCHEC sur les nouveaux tests — `'ail' !== 'fromage'` et `'menthe' !== 'sirop'`.
Les tests préexistants doivent tous rester au vert.

- [ ] **Étape 3 : écrire l'implémentation**

Dans `mobile/lib/typology.ts`, insérer **juste avant** la déclaration
`export function normalizeProductType` :

```ts
/**
 * (fragment d'étiquette Open Food Facts, type). Consultée AVANT les règles par
 * nom.
 *
 * « Boursin Ail & Fines Herbes » est un fromage et non de l'ail ; « Menthe
 * Verte » est un sirop et non de la menthe. Le nom seul ne peut pas le savoir :
 * il porte l'arôme, la catégorie porte la nature. Les 63 règles par nom ne sont
 * pas fausses, elles étaient seulement interrogées trop tôt.
 *
 * L'ordre va du plus précis au plus général — `olive-oils` avant `oils`.
 * Le vocabulaire des types reprend celui de TYPE_RULES, sauf `sirop`, absent
 * jusqu'ici du catalogue.
 */
const TYPE_PAR_CATEGORIE: ReadonlyArray<readonly [string, string]> = [
  ['olive-oils', 'huile'],
  ['cheeses', 'fromage'],
  ['yogurts', 'yaourt'],
  ['syrups', 'sirop'],
  ['juices', 'jus'],
  ['beers', 'biere'],
  ['wines', 'vin'],
  ['hams', 'jambon'],
  ['charcuteries', 'charcuterie'],
  ['pastas', 'pate'],
  ['rices', 'riz'],
  ['milks', 'lait'],
  ['butters', 'beurre'],
  ['eggs', 'oeuf'],
  ['coffees', 'cafe'],
];
```

Puis remplacer la signature et les deux premières lignes du corps de
`normalizeProductType`. Avant :

```ts
export function normalizeProductType(name: string | null | undefined): string | null {
  if (!name) return null;
  const nom = sansAccents(name);
  if (!nom) return null;
```

Après :

```ts
export function normalizeProductType(
  name: string | null | undefined,
  categories?: string[] | null,
): string | null {
  // Les catégories d'abord : elles décrivent la nature du produit, quand le nom
  // ne porte souvent que son arôme. Ce test précède volontairement le garde-fou
  // sur `name` — une fiche sans libellé mais catégorisée reste exploitable.
  for (const [fragment, type] of TYPE_PAR_CATEGORIE) {
    if (categories?.some((c) => c.includes(fragment))) return type;
  }

  if (!name) return null;
  const nom = sansAccents(name);
  if (!nom) return null;
```

Le reste de la fonction — boucle sur `TYPE_RULES` et repli sur le premier mot
significatif — n'est pas touché.

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
```

Attendu : `# fail 0`, et un total au moins égal à 35 tests (30 existants + 5).

- [ ] **Étape 5 : commit**

```bash
git add mobile/lib/typology.ts mobile/lib/typology.test.mjs
git commit -m "fix: la typologie lit la catégorie avant le nom du produit"
```

---

### Tâche 3 : propager le rayon jusqu'à l'insertion

**Fichiers :**
- Modifier : `mobile/lib/openfoodfacts.ts:9-17` (type), `:65-85` (mapOffProduct)
- Modifier : `mobile/stores/products.ts:91-110` (insertion)
- Modifier : `mobile/app/(tabs)/scan.tsx:~132` et `:~239` (deux fiches construites à la main)
- Test : `mobile/lib/openfoodfacts.test.mjs` (ajouts)

**Interfaces :**
- Consomme : `rayonDepuisCategories` de la tâche 1, `normalizeProductType(name, categories)` de la tâche 2.
- Produit : `FicheProduit` gagne `categoryKey: CleRayon | null`.

- [ ] **Étape 1 : écrire les tests qui échouent**

Ajouter à la fin de `mobile/lib/openfoodfacts.test.mjs` :

```js
test('la fiche porte le rayon déduit et la typologie corrigée', () => {
  const fiche = mapOffProduct('3073781091861', {
    product_name: 'Boursin® Onctueux Ail & Fines Herbes',
    brands: 'BOURSIN',
    product_quantity: 125,
    categories_tags: ['en:dairies', 'en:cheeses', 'en:cheeses-perishable'],
  });
  assert.equal(fiche.categoryKey, 'pls');
  assert.equal(fiche.productType, 'fromage');
  assert.equal(fiche.grammageG, 125);
});

test('un produit sans catégorie reçoit le rayon « autre »', () => {
  const fiche = mapOffProduct('1234567890123', { product_name: 'Chose' });
  assert.equal(fiche.categoryKey, 'autre');
});
```

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/openfoodfacts.test.mjs
```

Attendu : ÉCHEC, `undefined !== 'pls'`.

- [ ] **Étape 3 : écrire l'implémentation**

Dans `mobile/lib/openfoodfacts.ts`, ajouter l'import après la ligne 7 :

```ts
import { rayonDepuisCategories, type CleRayon } from './rayons.ts';
```

Ajouter le champ au type `FicheProduit`, après `productType` :

```ts
  /** Rayon déduit des catégories Open Food Facts, corrigeable par l'utilisateur. */
  categoryKey: CleRayon | null;
```

Remplacer le corps de `mapOffProduct` à partir de la ligne `const quantite` :

```ts
  const quantite = Number(data.product_quantity);
  const valide = Number.isFinite(quantite) && quantite > 0;
  const categories = data.categories_tags ?? [];
  const liquide = estLiquide(name, categories);

  return {
    ean13: ean,
    name,
    // Open Food Facts liste parfois plusieurs marques séparées par des
    // virgules, parfois avec une virgule de tête vide (ex. ", Danone") :
    // on retient la première valeur non vide plutôt que le premier élément.
    brand: (data.brands ?? '').split(',').map((m) => m.trim()).find((m) => m) ?? null,
    imageUrl: data.image_url || null,
    grammageG: valide && !liquide ? Math.round(quantite) : null,
    volumeMl: valide && liquide ? Math.round(quantite) : null,
    productType: normalizeProductType(name, categories),
    categoryKey: rayonDepuisCategories(categories),
  };
```

Dans `mobile/stores/products.ts`, ajouter dans l'objet passé à `.insert({...})`,
juste après `product_type: fiche.productType,` :

```ts
    // `?? 'autre'` et non `?? null` : une fiche peut venir de la file d'attente
    // persistée dans AsyncStorage, écrite par une version antérieure qui ne
    // connaissait pas ce champ. Le rayon est alors absent, pas nul — et un
    // produit sans rayon est exactement le défaut que ce correctif supprime.
    category: fiche.categoryKey ?? 'autre',
```

Dans `mobile/app/(tabs)/scan.tsx`, deux fiches sont construites à la main et
doivent recevoir le champ.

Dans `mettreEnAttente`, l'espace réservé hors ligne :

```ts
    await fileScan.enfiler({
      ean13: ean, name: ean, brand: null, imageUrl: null,
      grammageG: null, volumeMl: null, productType: null, categoryKey: null,
    });
```

Dans `ajouterManuel`, la saisie manuelle — sa signature gagne le rayon choisi :

```ts
  /** Produit absent d'Open Food Facts : on compose la fiche depuis la saisie. */
  const ajouterManuel = useCallback(
    (nom: string, marque: string, rayonChoisi: CleRayon) => {
      if (!ean || !nom) return;
      enregistrer({
        ean13: ean,
        name: nom,
        brand: marque || null,
        imageUrl: null,
        grammageG: null,
        volumeMl: null,
        // Aucune catégorie Open Food Facts ici : le nom est la seule source.
        productType: normalizeProductType(nom),
        categoryKey: rayonChoisi,
      });
    },
    [ean, enregistrer],
  );
```

Ajouter l'import en tête de `scan.tsx` :

```ts
import type { CleRayon } from '../../lib/rayons.ts';
```

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
npx tsc --noEmit
```

Attendu : `# fail 0`. `tsc` doit signaler l'appel à `onAjouterManuel` dans
`components/FicheScannee.tsx`, qui ne passe pas encore le rayon — c'est la
tâche 5 qui le corrige. Noter l'erreur et poursuivre.

- [ ] **Étape 5 : commit**

```bash
git add mobile/lib/openfoodfacts.ts mobile/lib/openfoodfacts.test.mjs mobile/stores/products.ts "mobile/app/(tabs)/scan.tsx"
git commit -m "feat: le rayon déduit accompagne la fiche jusqu'au catalogue"
```

---

### Tâche 4 : normaliser `products.category` en base

**Fichiers :**
- Créer : `supabase/migrations/0005_normalisation_rayons.sql`

**Interfaces :**
- Consomme : rien du code applicatif.
- Produit : `products.category` ne contient plus que des clés de `categories`.

- [ ] **Étape 1 : constater l'état avant migration**

Via l'outil MCP Supabase, projet `qmymwicsgilhoihtfdjm` :

```sql
select category, count(*) from public.products group by category order by 2 desc;
```

Attendu : des libellés de ticket de caisse (`P.L.S.`, `EPICERIE`,
`CHARCUT.TRAITEUR`, `ARTICLES INDISPONIBLES / NON FACTURÉS`…) et deux lignes
à `NULL`. **Copier ce résultat dans le message de commit** — c'est la seule
trace de l'état d'origine.

- [ ] **Étape 2 : écrire la migration**

Créer `supabase/migrations/0005_normalisation_rayons.sql` :

```sql
-- Normalise products.category : des libellés de ticket de caisse Carrefour
-- vers les clés canoniques de la table categories.
--
-- Le champ mélangeait jusqu'ici deux vocabulaires. « P.L.S. » ou
-- « CHARCUT.TRAITEUR » sont ce qu'imprime le ticket Carrefour, et
-- « ARTICLES INDISPONIBLES / NON FACTURÉS » n'est même pas un rayon mais une
-- section de ticket. La table category_aliases contenait déjà la traduction
-- exacte, elle n'avait jamais été appliquée.
--
-- Sans risque au 21/08/2026, et cette fenêtre se referme : products.category
-- n'a aujourd'hui aucun lecteur côté Supabase. Le mobile le sélectionne sans
-- l'afficher, l'extension l'ignore, et le front web interroge encore l'ancien
-- FastAPI. Dès que le wizard sera porté (lot 4), la même opération deviendra
-- une migration à risque.

update public.products p
set category = a.key_canonical
from public.category_aliases a
where a.label_raw = p.category
  and a.user_id = p.user_id;

-- Produits scannés avant ce correctif : l'insertion n'écrivait pas le rayon.
update public.products
set category = 'autre'
where category is null;
```

- [ ] **Étape 3 : appliquer la migration**

Via l'outil MCP Supabase `apply_migration`, projet `qmymwicsgilhoihtfdjm`,
nom `normalisation_rayons`, avec le contenu ci-dessus.

- [ ] **Étape 4 : vérifier le résultat**

```sql
select p.category, count(*) as produits,
       (select c.label from public.categories c
         where c.key = p.category and c.user_id = p.user_id) as libelle
from public.products p group by p.category order by 2 desc;
```

Attendu : **toutes** les valeurs sont des clés de `categories` (`pls`,
`epicerie`, `parfumerie`, `boissons`, `charcuterie`, `droguerie`,
`fruits_legumes`, `maison`, `autre`), chacune avec un libellé non nul, et
**aucun `NULL`**. Le total doit valoir 67.

Si une ligne rend un libellé nul, la migration a laissé une valeur non
traduite : ne pas poursuivre, corriger la table `category_aliases` d'abord.

- [ ] **Étape 5 : commit**

```bash
git add supabase/migrations/0005_normalisation_rayons.sql
git commit -m "feat: normalise les rayons des produits en clés canoniques"
```

---

### Tâche 5 : afficher et corriger le rayon sur la fiche de scan

**Fichiers :**
- Créer : `mobile/components/SelecteurRayon.tsx`
- Modifier : `mobile/components/FicheScannee.tsx`
- Modifier : `mobile/app/(tabs)/scan.tsx`

**Interfaces :**
- Consomme : `RAYONS`, `libelleRayon`, `CleRayon` (tâche 1) ; `FicheProduit.categoryKey` (tâche 3).
- Produit : `FicheScannee` gagne les props `rayon: CleRayon` et `onChangerRayon: (cle: CleRayon) => void` ; `onAjouterManuel` gagne un troisième argument `rayon`.

- [ ] **Étape 1 : créer le sélecteur**

Créer `mobile/components/SelecteurRayon.tsx` :

```tsx
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RAYONS, type CleRayon } from '../lib/rayons.ts';
import { colors, radius, spacing } from '../lib/theme';

type Props = {
  valeur: CleRayon;
  onChoisir: (cle: CleRayon) => void;
  onFermer: () => void;
};

/**
 * Choix du rayon, en liste déroulante posée dans la fiche plutôt qu'en modal
 * centré — convention du projet pour toute action mobile.
 */
export function SelecteurRayon({ valeur, onChoisir, onFermer }: Props) {
  return (
    <View style={s.bloc}>
      <View style={s.entete}>
        <Text style={s.titre}>Rayon</Text>
        <Pressable onPress={onFermer} hitSlop={8}>
          <Text style={s.fermer}>Fermer</Text>
        </Pressable>
      </View>
      <ScrollView style={s.liste} keyboardShouldPersistTaps="handled">
        {RAYONS.map((r) => {
          const actif = r.cle === valeur;
          return (
            <Pressable
              key={r.cle}
              style={[s.ligne, actif && s.ligneActive]}
              onPress={() => onChoisir(r.cle)}
            >
              <Text style={[s.ligneTexte, actif && s.ligneTexteActif]}>{r.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  bloc: { gap: spacing.sm },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titre: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  fermer: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  // Hauteur bornée : les 10 rayons ne doivent pas repousser les boutons
  // d'action hors de l'écran sur un petit iPhone.
  liste: { maxHeight: 220 },
  ligne: {
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  ligneActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  ligneTexte: { fontSize: 15, color: colors.text },
  ligneTexteActif: { fontWeight: '700', color: colors.accent },
});
```

- [ ] **Étape 2 : afficher le rayon dans la fiche**

Dans `mobile/components/FicheScannee.tsx` :

Ajouter les imports :

```tsx
import { libelleRayon, type CleRayon } from '../lib/rayons.ts';
import { SelecteurRayon } from './SelecteurRayon';
```

`RAYONS` n'est pas importé ici : seul `SelecteurRayon` parcourt la liste.

Étendre le type `Props` — remplacer la ligne `onAjouterManuel` et ajouter deux
entrées :

```tsx
  /** Saisie manuelle, quand Open Food Facts ne connaît pas le code. */
  onAjouterManuel: (nom: string, marque: string, rayon: CleRayon) => void;
  /** Rayon retenu, déduit puis éventuellement corrigé à la main. */
  rayon: CleRayon;
  onChangerRayon: (cle: CleRayon) => void;
```

Étendre la déstructuration des props :

```tsx
export function FicheScannee({
  resultat, ean, chargement, message, onAjouter, onAjouterManuel,
  onMettreEnAttente, onIgnorer, rayon, onChangerRayon,
}: Props) {
```

Ajouter l'état d'ouverture du sélecteur, à côté de `saisieManuelle` :

```tsx
  const [choixRayon, setChoixRayon] = useState(false);
```

Ajouter, dans la branche `fiche` — entre le `</View>` fermant `s.entete` et le
bloc `{message && ...}` :

```tsx
          {choixRayon ? (
            <SelecteurRayon
              valeur={rayon}
              onChoisir={(cle) => { onChangerRayon(cle); setChoixRayon(false); }}
              onFermer={() => setChoixRayon(false)}
            />
          ) : (
            <Pressable style={s.rayon} onPress={() => setChoixRayon(true)}>
              <Text style={s.rayonLabel}>Rayon</Text>
              <Text style={s.rayonValeur}>{libelleRayon(rayon)}</Text>
            </Pressable>
          )}
```

Ajouter le même bloc dans la branche de saisie manuelle, juste après le champ
« Marque » — un produit inconnu d'Open Food Facts n'a aucun rayon déduit, c'est
là que le choix compte le plus :

```tsx
          {choixRayon ? (
            <SelecteurRayon
              valeur={rayon}
              onChoisir={(cle) => { onChangerRayon(cle); setChoixRayon(false); }}
              onFermer={() => setChoixRayon(false)}
            />
          ) : (
            <Pressable style={s.rayon} onPress={() => setChoixRayon(true)}>
              <Text style={s.rayonLabel}>Rayon</Text>
              <Text style={s.rayonValeur}>{libelleRayon(rayon)}</Text>
            </Pressable>
          )}
```

Modifier l'appel de la saisie manuelle pour transmettre le rayon :

```tsx
              onPress={() => onAjouterManuel(nom.trim(), marque.trim(), rayon)}
```

Ajouter les styles à `StyleSheet.create` :

```tsx
  rayon: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
  },
  rayonLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  rayonValeur: { fontSize: 15, fontWeight: '600', color: colors.accent },
```

- [ ] **Étape 3 : câbler l'état dans l'écran de scan**

Dans `mobile/app/(tabs)/scan.tsx` :

Ajouter l'état, à côté des autres `useState` :

```tsx
  // Rayon retenu pour la fiche en cours. Initialisé au rayon déduit dès qu'un
  // résultat arrive, puis corrigeable ; remis à « autre » entre deux scans pour
  // qu'un choix manuel ne déteigne pas sur le produit suivant.
  const [rayon, setRayon] = useState<CleRayon>('autre');
```

L'import posé en tâche 3 reste valable tel quel — `CleRayon` n'est employé
qu'en position de type :

```tsx
import type { CleRayon } from '../../lib/rayons.ts';
```

Après la mise à jour de `resultat`, poser le rayon déduit. Repérer l'endroit où
`setResultat(...)` est appelé avec le résultat de `lookupEan` et ajouter juste
après :

```tsx
      setRayon(r.etat === 'trouve' ? (r.fiche.categoryKey ?? 'autre') : 'autre');
```

Dans `reprendre` (remise en état entre deux scans), ajouter :

```tsx
    setRayon('autre');
```

Modifier `ajouter` pour transmettre le rayon retenu plutôt que celui de la fiche :

```tsx
  const ajouter = useCallback(() => {
    // Le rayon affiché prime sur celui déduit : l'utilisateur a pu le corriger.
    if (resultat?.etat === 'trouve') enregistrer({ ...resultat.fiche, categoryKey: rayon });
  }, [resultat, enregistrer, rayon]);
```

Transmettre les deux nouvelles props au composant :

```tsx
        rayon={rayon}
        onChangerRayon={setRayon}
```

- [ ] **Étape 4 : vérifier la compilation**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
```

Attendu : `tsc` ne signale plus rien, `# fail 0`.

- [ ] **Étape 5 : commit**

```bash
git add mobile/components/SelecteurRayon.tsx mobile/components/FicheScannee.tsx "mobile/app/(tabs)/scan.tsx"
git commit -m "feat: le rayon s'affiche sur la fiche scannée et se corrige d'un tap"
```

---

### Tâche 6 : récupération de mot de passe par lien profond

**Fichiers :**
- Modifier : `mobile/lib/supabase.ts` (flux PKCE)
- Créer : `mobile/app/reinitialisation.tsx`
- Modifier : `mobile/app/_layout.tsx:25-30` (garde de navigation)
- Modifier : `mobile/app/login.tsx` (lien et écran d'envoi)

**Interfaces :**
- Consomme : `supabase` de `lib/supabase.ts`.
- Produit : route `/reinitialisation`, atteignable par `coursesapp://reinitialisation?code=...`.

- [ ] **Étape 1 : passer le client en PKCE**

Dans `mobile/lib/supabase.ts`, ajouter dans le bloc `auth` :

```ts
    // PKCE et non le flux implicite (défaut de supabase-js 2.112) : sur mobile,
    // le lien de récupération revient par un lien profond, et un fragment `#`
    // survit mal au passage par le système. PKCE fait porter au lien un
    // paramètre de requête `code`, qui arrive intact.
    flowType: 'pkce',
```

- [ ] **Étape 2 : ouvrir la route au visiteur non connecté**

Dans `mobile/app/_layout.tsx`, remplacer le second `useEffect` :

```tsx
  useEffect(() => {
    if (!pret) return;
    // Deux routes sont accessibles sans session. `reinitialisation` doit
    // en outre rester atteignable AVEC une session : l'échange du code de
    // récupération en crée une, et une redirection vers l'accueil à ce
    // moment-là escamoterait l'écran de saisie du nouveau mot de passe.
    const route = segments[0] ?? '';
    const publique = route === 'login' || route === 'reinitialisation';
    if (!session && !publique) router.replace('/login');
    if (session && route === 'login') router.replace('/');
  }, [pret, session, segments, router]);
```

- [ ] **Étape 3 : écrire l'écran de réinitialisation**

Créer `mobile/app/reinitialisation.tsx` :

```tsx
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../lib/theme';

const ERREUR_LIEN = 'Ce lien est expiré ou a déjà servi. Redemande un lien depuis l\'écran de connexion.';
const ERREUR_GENERIQUE = 'Enregistrement impossible pour le moment. Réessaie dans un instant.';
const LONGUEUR_MIN = 8;

export default function Reinitialisation() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();
  const [pret, setPret] = useState(false);
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const enCoursRef = useRef(false);

  // Le code du lien s'échange une seule fois contre une session de
  // récupération. Tant qu'il n'est pas échangé, `updateUser` n'aurait aucune
  // identité sur laquelle agir.
  useEffect(() => {
    let vivant = true;
    (async () => {
      if (!code) {
        if (vivant) { setErreur(ERREUR_LIEN); setPret(true); }
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!vivant) return;
      if (error) {
        console.error('[reinitialisation]', error.message);
        setErreur(ERREUR_LIEN);
      }
      setPret(true);
    })();
    return () => { vivant = false; };
  }, [code]);

  const enregistrer = async () => {
    if (enCoursRef.current) return;
    if (motDePasse.length < LONGUEUR_MIN) {
      setErreur(`Le mot de passe doit faire au moins ${LONGUEUR_MIN} caractères.`);
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur('Les deux saisies diffèrent.');
      return;
    }
    enCoursRef.current = true;
    setEnCours(true);
    setErreur(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: motDePasse });
      if (error) {
        console.error('[reinitialisation]', error.message);
        setErreur(ERREUR_GENERIQUE);
        return;
      }
      // La session de récupération vaut session ordinaire : la garde de
      // `_layout.tsx` mènera à l'accueil dès qu'on quitte cette route.
      router.replace('/');
    } catch (err) {
      console.error('[reinitialisation]', err);
      setErreur(ERREUR_GENERIQUE);
    } finally {
      enCoursRef.current = false;
      setEnCours(false);
    }
  };

  if (!pret) {
    return (
      <View style={[s.ecran, s.centre]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.ecran}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.carte}>
        <Text style={s.titre}>Nouveau mot de passe</Text>

        {erreur && <Text style={s.erreur}>{erreur}</Text>}

        {code && (
          <>
            <Text style={s.label}>Nouveau mot de passe</Text>
            <TextInput
              style={s.champ}
              value={motDePasse}
              onChangeText={setMotDePasse}
              secureTextEntry
              textContentType="newPassword"
              autoFocus
            />

            <Text style={s.label}>Confirmation</Text>
            <TextInput
              style={s.champ}
              value={confirmation}
              onChangeText={setConfirmation}
              secureTextEntry
              textContentType="newPassword"
            />

            <Pressable style={s.bouton} onPress={enregistrer} disabled={enCours}>
              {enCours
                ? <ActivityIndicator color={colors.accentContrast} />
                : <Text style={s.boutonTexte}>Enregistrer</Text>}
            </Pressable>
          </>
        )}

        <Pressable onPress={() => router.replace('/login')}>
          <Text style={s.lien}>Revenir à la connexion</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bg },
  centre: { alignItems: 'center' },
  carte: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  titre: {
    fontSize: 24, fontWeight: '800', color: colors.text,
    textAlign: 'center', marginBottom: spacing.md,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: spacing.sm },
  champ: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: 16, color: colors.text, backgroundColor: colors.surface,
  },
  erreur: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  bouton: {
    backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.lg,
    alignItems: 'center', marginTop: spacing.lg,
  },
  boutonTexte: { color: colors.accentContrast, fontWeight: '700', fontSize: 16 },
  lien: {
    color: colors.textMuted, fontSize: 13, fontWeight: '600',
    textAlign: 'center', textDecorationLine: 'underline', marginTop: spacing.lg,
  },
});
```

- [ ] **Étape 4 : ajouter le lien sur l'écran de connexion**

Dans `mobile/app/login.tsx`, ajouter l'état et la fonction d'envoi, après
`const enCoursRef` :

```tsx
  const [envoye, setEnvoye] = useState(false);

  /**
   * Demande un lien de récupération. Le message de confirmation est le même
   * que l'adresse existe ou non : répondre différemment révélerait quels
   * comptes existent.
   */
  const demanderLien = async () => {
    if (!email.trim()) {
      setErreur('Renseigne ton adresse e-mail, puis redemande le lien.');
      return;
    }
    setErreur(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'coursesapp://reinitialisation',
      });
      if (error) console.error('[recuperation]', error.message);
    } catch (err) {
      console.error('[recuperation]', err);
    }
    setEnvoye(true);
  };
```

Ajouter, après le bouton « Se connecter » :

```tsx
        {envoye ? (
          <Text style={s.info}>
            Si un compte existe pour cette adresse, un lien vient d'y être envoyé.
            Ouvre-le depuis ce téléphone.
          </Text>
        ) : (
          <Pressable onPress={demanderLien}>
            <Text style={s.lien}>Mot de passe oublié</Text>
          </Pressable>
        )}
```

Ajouter les styles :

```tsx
  lien: {
    color: colors.textMuted, fontSize: 13, fontWeight: '600',
    textAlign: 'center', textDecorationLine: 'underline', marginTop: spacing.lg,
  },
  info: {
    color: colors.accent, fontSize: 13, fontWeight: '600',
    textAlign: 'center', marginTop: spacing.lg,
  },
```

- [ ] **Étape 5 : vérifier la compilation**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
```

Attendu : aucune erreur, `# fail 0`.

- [ ] **Étape 6 : commit**

```bash
git add mobile/lib/supabase.ts mobile/app/reinitialisation.tsx mobile/app/_layout.tsx mobile/app/login.tsx
git commit -m "feat: récupération de mot de passe par lien profond PKCE"
```

---

### Tâche 7 : livrer la version

**Fichiers :**
- Modifier : `mobile/app.json` (`ios.buildNumber`)
- Créer : `mobile/.nvmrc`
- Modifier : `mobile/package.json` (déjà modifié localement, à inclure)

- [ ] **Étape 1 : figer la version de Node pour le dépôt**

Créer `mobile/.nvmrc` avec pour seul contenu :

```
22
```

- [ ] **Étape 2 : incrémenter le numéro de build**

Dans `mobile/app.json`, passer `expo.ios.buildNumber` de `"1"` à `"2"`.

App Store Connect refuse un numéro de build déjà déposé : sans cette
incrémentation, la livraison échoue **après** une compilation complète.

- [ ] **Étape 3 : vérification finale avant poussée**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
npx expo-doctor
node -e "console.log(require('./app.json').expo.ios.buildNumber)"
```

Attendu : aucune erreur TypeScript, `# fail 0`, expo-doctor au vert, et `2`.

- [ ] **Étape 4 : commit et poussée**

```bash
git add mobile/.nvmrc mobile/app.json mobile/package.json
git commit -m "chore: version 2 pour TestFlight, Node 22 fixé pour les tests"
git push origin mobile/expo-scan
```

La poussée déclenche Xcode Cloud, qui compile puis dépose sur TestFlight.
Compter vingt à trente minutes.

- [ ] **Étape 5 : manipulation à demander à Angelo**

Avant qu'il ne teste le lien de récupération, il doit ajouter
`coursesapp://reinitialisation` aux **Redirect URLs** du projet Supabase :

```
https://supabase.com/dashboard/project/qmymwicsgilhoihtfdjm/auth/url-configuration
```

Sans cela, Supabase ignore le `redirectTo` et renvoie vers le Site URL —
`http://localhost:3000` — c'est-à-dire nulle part.

- [ ] **Étape 6 : vérification sur l'appareil**

Le lien profond ne peut pas être vérifié autrement que sur un vrai téléphone.
À contrôler, dans l'ordre :

1. Le catalogue affiche 67 produits.
2. Un produit scanné affiche un rayon plausible sur la fiche.
3. Un tap sur le rayon ouvre la liste des 10, et le choix se reflète.
4. Après ajout, le rayon retenu est bien celui affiché — vérifiable en base :
   `select name, category, product_type from public.products order by created_at desc limit 3;`
5. « Mot de passe oublié » envoie un courriel, dont le lien ouvre l'application
   sur l'écran de saisie et non sur l'accueil.

## Ce que ce plan ne fait pas

- Le partage du foyer et l'invitation — conception à part.
- La correction du rayon depuis l'onglet Produits : seul le moment du scan
  permet de corriger. Un produit déjà au catalogue reste sur son rayon.
- Le portage du wizard (lot 4) et le pont vers l'extension (lot 5).
