# Refonte des recettes — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour dérouler ce plan tâche par tâche. Les étapes
> emploient la syntaxe à cases (`- [ ]`).

**But :** rendre les recettes présentables et utilisables — liste en cartes
photo, écran de détail avec quantités recalculées, création par recherche de
produits, modification et suppression. La photo prise sur l'appareil vient en
seconde phase.

**Architecture :** toute la logique calculable — mise à l'échelle des quantités,
couleur d'aplat, filtrage du catalogue, analyse d'une réponse Open Food Facts —
vit dans des modules purs testables sous Node. Les écrans n'orchestrent que
l'affichage.

**Pile :** Expo SDK 57, React Native 0.86, expo-router, TypeScript, Supabase JS
2.112, `node:test`. En phase 4 seulement : `expo-image-picker` et Supabase
Storage.

**Spécification :** `docs/superpowers/specs/2026-08-22-refonte-recettes-design.md`

## Contraintes globales

- **Tests : Node ≥ 22.** Depuis `mobile/` :
  `/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs`
- **Aucune dépendance native dans les phases 1 à 3.** `expo-image-picker`
  n'entre qu'en phase 4, avec son `prebuild`.
- **La logique pure ne doit jamais importer le client Supabase** ni un module
  React Native : elle ne serait plus testable sous Node — leçon du lot 4, où
  `construireItems` a dû être déplacée pour cette raison.
- **Les tâches d'interface décrivent le comportement, les états et les textes
  exacts, pas le balisage.** Le JSX suit les composants existants —
  `components/FicheScannee.tsx`, `components/ProductRow.tsx`, `app/login.tsx` :
  `StyleSheet.create` en fin de fichier, jetons de `lib/theme.ts`, `Pressable`
  plutôt que `TouchableOpacity`.
- **Zéro emoji dans l'interface.** Thème clair, couleurs et espacements depuis
  `lib/theme.ts` — jamais de valeur littérale hors de ce fichier.
- **Messages d'erreur en français**, jamais la réponse brute d'un service ; le
  détail technique part à `console.error`.
- **Jamais de recherche Open Food Facts à la frappe** : validation explicite,
  trois caractères au minimum. La route a répondu `503` le 22/08.
- **Ne rien pousser avant les tâches de livraison** (8 et 12). Xcode Cloud
  surveille `mobile/` sur `mobile/expo-scan` avec « Auto-cancel Builds ».

---

## Phase 1 — La logique calculable

### Tâche 1 : affichage des recettes

**Fichiers :**
- Créer : `mobile/lib/recettes-affichage.ts`
- Modifier : `mobile/lib/theme.ts`
- Test : `mobile/lib/recettes-affichage.test.mjs`

**Interfaces :**
- Produit :
  - `quantitePourParts(quantiteParPart: number, parts: number): number`
  - `initiale(nom: string): string`
  - `indiceAplat(nom: string): number` — entier de 0 à 5, stable
  - `filtrerCatalogue<T extends { name: string; brand?: string | null }>(produits: T[], requete: string): T[]`

- [x] **Étape 1 : écrire le test qui échoue**

Créer `mobile/lib/recettes-affichage.test.mjs` :

```js
/**
 * Calculs d'affichage des recettes. Fonctions pures, sans réseau ni React.
 * Lancer : node --test mobile/lib/recettes-affichage.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  quantitePourParts, initiale, indiceAplat, filtrerCatalogue,
} from './recettes-affichage.ts';

test('la quantité suit le nombre de parts', () => {
  assert.equal(quantitePourParts(50, 4), 200);
  assert.equal(quantitePourParts(50, 1), 50);
  assert.equal(quantitePourParts(0, 4), 0);
});

test('un nombre de parts absurde ne produit pas de quantité absurde', () => {
  assert.equal(quantitePourParts(50, 0), 0);
  assert.equal(quantitePourParts(50, -3), 0);
});

test("l'initiale est la première lettre, en majuscule", () => {
  assert.equal(initiale('gratin dauphinois'), 'G');
  assert.equal(initiale('  Salade César'), 'S');
  assert.equal(initiale('Œufs mimosa'), 'Œ');
});

test("un nom vide donne une initiale neutre plutôt qu'une erreur", () => {
  assert.equal(initiale(''), '?');
  assert.equal(initiale('   '), '?');
});

test("la couleur d'aplat est stable pour un même nom", () => {
  // Elle n'est pas stockée : elle doit se redériver identique à chaque rendu,
  // sinon la liste scintillerait d'un affichage à l'autre.
  assert.equal(indiceAplat('Gratin dauphinois'), indiceAplat('Gratin dauphinois'));
});

test("la couleur d'aplat reste dans la palette", () => {
  for (const nom of ['A', 'Gratin', 'Salade César', '', 'Œufs']) {
    const i = indiceAplat(nom);
    assert.ok(Number.isInteger(i) && i >= 0 && i < 6, `hors palette pour ${nom} : ${i}`);
  }
});

test('le filtrage ignore la casse et les accents', () => {
  const produits = [
    { name: 'Crème Fraîche Épaisse', brand: 'CARREFOUR' },
    { name: 'Spaghetti n°5', brand: null },
  ];
  assert.equal(filtrerCatalogue(produits, 'creme').length, 1);
  assert.equal(filtrerCatalogue(produits, 'CRÈME').length, 1);
  assert.equal(filtrerCatalogue(produits, 'fraiche epaisse').length, 1);
});

test('le filtrage porte aussi sur la marque', () => {
  const produits = [{ name: 'Lait demi-écrémé', brand: 'CARREFOUR' }];
  assert.equal(filtrerCatalogue(produits, 'carrefour').length, 1);
});

test('une requête vide ou trop courte ne filtre rien', () => {
  const produits = [{ name: 'A', brand: null }, { name: 'B', brand: null }];
  assert.equal(filtrerCatalogue(produits, '').length, 2);
  assert.equal(filtrerCatalogue(produits, '  ').length, 2);
});

test('une requête sans correspondance rend une liste vide, pas tout le catalogue', () => {
  const produits = [{ name: 'Lait', brand: null }];
  assert.equal(filtrerCatalogue(produits, 'perlimpinpin').length, 0);
});
```

- [x] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/recettes-affichage.test.mjs
```

Attendu : ÉCHEC, `ERR_MODULE_NOT_FOUND` sur `./recettes-affichage.ts`.

- [x] **Étape 3 : ajouter la palette au thème**

Dans `mobile/lib/theme.ts`, ajouter à l'objet `colors`, avant sa fermeture :

```ts
  // Aplats des recettes sans photo. Six teintes sourdes, assez contrastées
  // pour porter du texte blanc, assez proches pour ne pas jurer entre elles.
  aplats: ['#2D6A4F', '#52796F', '#B08968', '#6B705C', '#8A5A44', '#4A6FA5'],
```

- [x] **Étape 4 : écrire le module**

Créer `mobile/lib/recettes-affichage.ts` :

```ts
/**
 * Calculs d'affichage des recettes : mise à l'échelle, aplat de couleur,
 * filtrage du catalogue.
 *
 * Aucun import de React ni de Supabase : ces fonctions doivent rester
 * exécutables sous `node --test`.
 */

/** Nombre de teintes dans `colors.aplats`. */
const NB_APLATS = 6;

/**
 * Quantité d'un ingrédient pour un nombre de parts donné.
 *
 * Un nombre de parts nul ou négatif rend 0 : mieux vaut n'afficher aucune
 * quantité qu'une quantité négative, qui remonterait telle quelle jusqu'au
 * panier.
 */
export function quantitePourParts(quantiteParPart: number, parts: number): number {
  if (!Number.isFinite(quantiteParPart) || !Number.isFinite(parts)) return 0;
  if (parts <= 0) return 0;
  return quantiteParPart * parts;
}

/** Première lettre du nom, en majuscule. `?` si le nom est vide. */
export function initiale(nom: string): string {
  const n = (nom ?? '').trim();
  return n.length > 0 ? n[0].toLocaleUpperCase('fr-FR') : '?';
}

/**
 * Indice de teinte pour une recette sans photo.
 *
 * Dérivé du nom plutôt que stocké : la même recette garde la même couleur d'un
 * affichage à l'autre, sans colonne supplémentaire ni migration.
 */
export function indiceAplat(nom: string): number {
  let somme = 0;
  for (const c of nom ?? '') somme = (somme + c.codePointAt(0)!) % 100_000;
  return somme % NB_APLATS;
}

const sansAccents = (s: string) =>
  (s ?? '').toLowerCase().normalize('NFD')
    // Points de code plutôt que caractères littéraux : ces marques sont
    // invisibles dans un éditeur et se perdent au copier-coller.
    .replace(/[\u0300-\u036F]/g, '');

/**
 * Filtre le catalogue sur le nom et la marque.
 *
 * Tous les mots de la requête doivent apparaître, dans n'importe quel ordre :
 * « fraiche epaisse » trouve « Crème Fraîche Épaisse », ce qu'une recherche de
 * sous-chaîne exacte manquerait.
 */
export function filtrerCatalogue<T extends { name: string; brand?: string | null }>(
  produits: T[],
  requete: string,
): T[] {
  const mots = sansAccents(requete).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return produits;
  return produits.filter((p) => {
    const foin = sansAccents(`${p.name} ${p.brand ?? ''}`);
    return mots.every((m) => foin.includes(m));
  });
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
git add mobile/lib/recettes-affichage.ts mobile/lib/recettes-affichage.test.mjs mobile/lib/theme.ts
git commit -m "feat: calculs d'affichage des recettes"
```

---

### Tâche 2 : recherche Open Food Facts par nom

**Fichiers :**
- Modifier : `mobile/lib/openfoodfacts.ts`
- Test : `mobile/lib/openfoodfacts.test.mjs`

**Interfaces :**
- Consomme : `mapOffProduct`, `FicheProduit` du même module.
- Produit :
  - `analyserRechercheNom(json: unknown): FicheProduit[]`
  - `rechercherParNom(requete: string): Promise<ResultatRechercheNom>`
  - `type ResultatRechercheNom = { etat: 'trouve'; fiches: FicheProduit[] } | { etat: 'vide' } | { etat: 'indisponible' }`

- [x] **Étape 1 : écrire les tests qui échouent**

Ajouter à la fin de `mobile/lib/openfoodfacts.test.mjs` :

```js
test('une réponse de recherche devient une liste de fiches', () => {
  const fiches = analyserRechercheNom({
    count: 2,
    products: [
      { code: '3154230802280', product_name: 'Lardons fumés', brands: 'Herta',
        product_quantity: 150, categories_tags: ['en:charcuteries'], nutriscore_grade: 'd' },
      { code: '3154230802136', product_name: 'Lardons Fumés 200g', brands: 'Herta' },
    ],
  });
  assert.equal(fiches.length, 2);
  assert.equal(fiches[0].ean13, '3154230802280');
  assert.equal(fiches[0].nutriscore, 'd');
  assert.equal(fiches[0].categoryKey, 'charcuterie');
});

test('les produits sans nom sont écartés, pas rendus vides', () => {
  // mapOffProduct rend null pour une fiche sans libellé : elle serait
  // inutilisable dans une liste de résultats.
  const fiches = analyserRechercheNom({
    products: [{ code: '111', product_name: '' }, { code: '222', product_name: 'Bon' }],
  });
  assert.equal(fiches.length, 1);
  assert.equal(fiches[0].name, 'Bon');
});

test('une réponse vide ou malformée ne casse rien', () => {
  assert.deepEqual(analyserRechercheNom({ products: [] }), []);
  assert.deepEqual(analyserRechercheNom({}), []);
  assert.deepEqual(analyserRechercheNom(null), []);
  assert.deepEqual(analyserRechercheNom('pas du json'), []);
});
```

Ajouter `analyserRechercheNom` à l'import en tête du fichier :

```js
import { mapOffProduct, estLiquide, echappe, analyserRechercheNom } from './openfoodfacts.ts';
```

- [x] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/openfoodfacts.test.mjs
```

Attendu : ÉCHEC, `analyserRechercheNom is not a function`.

- [x] **Étape 3 : écrire l'implémentation**

Ajouter à la fin de `mobile/lib/openfoodfacts.ts` :

```ts
/**
 * Convertit une réponse de recherche en fiches exploitables.
 *
 * Séparée de l'appel réseau pour être testable : c'est la partie où une
 * réponse inattendue ferait le plus de dégâts.
 */
export function analyserRechercheNom(json: unknown): FicheProduit[] {
  const produits = (json as { products?: unknown })?.products;
  if (!Array.isArray(produits)) return [];
  return produits
    .map((p: OffData & { code?: string }) => mapOffProduct(p?.code ?? '', p ?? {}))
    .filter((f): f is FicheProduit => f !== null);
}

export type ResultatRechercheNom =
  | { etat: 'trouve'; fiches: FicheProduit[] }
  | { etat: 'vide' }
  | { etat: 'indisponible' };

/** Nombre de résultats demandés : au-delà, la liste devient illisible au pouce. */
const TAILLE_PAGE = 12;

/**
 * Cherche des produits par nom dans Open Food Facts.
 *
 * On emploie `cgi/search.pl` et non `/api/v2/search` : cette dernière répondait
 * `503` le 22/08/2026 — « Page temporarily unavailable ». L'ancienne route
 * fonctionne et rend les mêmes champs.
 *
 * L'indisponibilité est un état ordinaire, pas une erreur : Open Food Facts est
 * un service gratuit, et le catalogue local reste utilisable sans lui.
 */
export async function rechercherParNom(requete: string): Promise<ResultatRechercheNom> {
  const q = requete.trim();
  if (q.length < 3) return { etat: 'vide' };

  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    const url = 'https://world.openfoodfacts.org/cgi/search.pl'
      + `?search_terms=${encodeURIComponent(q)}`
      + '&search_simple=1&action=process&json=1'
      + `&page_size=${TAILLE_PAGE}`
      + `&fields=${CHAMPS},code`;
    const reponse = await fetch(url, {
      headers: { 'User-Agent': 'courses-app/1.0 (usage familial)' },
      signal: controleur.signal,
    });
    if (!reponse.ok) return { etat: 'indisponible' };
    const fiches = analyserRechercheNom(await reponse.json());
    return fiches.length ? { etat: 'trouve', fiches } : { etat: 'vide' };
  } catch {
    return { etat: 'indisponible' };
  } finally {
    clearTimeout(minuteur);
  }
}
```

- [x] **Étape 4 : lancer les tests et vérifier qu'ils passent**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
npx tsc --noEmit
```

Attendu : `# fail 0`, aucune erreur TypeScript.

- [x] **Étape 5 : éprouver la vraie route, une fois**

```bash
curl -s --max-time 25 "https://world.openfoodfacts.org/cgi/search.pl?search_terms=lardons+fumes&search_simple=1&action=process&json=1&page_size=3&fields=product_name,code" -H "User-Agent: courses-app/1.0 (essai)" | head -c 300
```

Attendu : du JSON contenant des produits. Si la route rend du HTML ou un `503`,
**ne pas modifier le code** : `rechercherParNom` traite déjà ce cas comme
`indisponible`, et c'est exactement le comportement voulu. Noter l'observation.

- [x] **Étape 6 : commit**

```bash
git add mobile/lib/openfoodfacts.ts mobile/lib/openfoodfacts.test.mjs
git commit -m "feat: recherche de produits par nom dans Open Food Facts"
```

---

## Phase 2 — Les écrans

### Tâche 3 : la liste en cartes photo

**Fichiers :**
- Créer : `mobile/components/CarteRecette.tsx`
- Modifier : `mobile/app/(tabs)/recettes/index.tsx`

**Interfaces :**
- Consomme : `initiale`, `indiceAplat` de `lib/recettes-affichage.ts` ;
  `Recipe` de `stores/recipes.ts`.
- Produit : `<CarteRecette recette={r} onOuvrir={() => …} />`

- [x] **Étape 1 : écrire la carte**

`mobile/components/CarteRecette.tsx` affiche, dans une carte de la largeur de
l'écran moins les marges :

- une **photo en bandeau** de 160 points de haut, `resizeMode="cover"`, coins
  supérieurs arrondis ;
- **à défaut de photo**, un aplat de `colors.aplats[indiceAplat(nom)]` portant
  `initiale(nom)` en blanc, 44 points, gras ;
- sous l'image : le nom en 17 gras, puis
  `« N parts · M ingrédients »` en 13 dans `colors.textMuted`.

Toute la carte est un `Pressable` menant à `onOuvrir`.

- [x] **Étape 2 : refondre la liste**

Dans `mobile/app/(tabs)/recettes/index.tsx`, remplacer `LigneRetenue` par
`<CarteRecette>`, retirer le séparateur, et espacer les cartes de `spacing.lg`.

La ligne redevient **cliquable** — elle mène désormais à
`/recettes/[id]`, qui existe à la tâche 4. Elle avait été rendue inerte faute
d'écran de détail ; le commentaire qui l'expliquait est à retirer.

Les trois états restent : chargement, erreur avec « Réessayer », et vide avec
le texte existant.

- [x] **Étape 3 : vérifier**

```bash
npx tsc --noEmit
```

Attendu : une erreur sur la route `/recettes/[id]`, qui n'existe pas encore.
Créer le fichier en coquille rendant `null` pour lever le blocage — la tâche 4
le remplit.

- [x] **Étape 4 : commit**

```bash
git add mobile/components/CarteRecette.tsx "mobile/app/(tabs)/recettes"
git commit -m "feat: la liste des recettes passe en cartes photo"
```

---

### Tâche 4 : l'écran de détail

**Fichiers :**
- Créer : `mobile/app/(tabs)/recettes/[id].tsx`
- Modifier : `mobile/stores/recipes.ts`

**Interfaces :**
- Consomme : `quantitePourParts`, `initiale`, `indiceAplat` ;
  `formatIngredientQty` de `lib/unites.ts` ; `useProducts`.
- Produit : `useRecette(id: string): { recette: Recipe | null; chargement: boolean; erreur: string | null; recharger: () => Promise<void> }`

- [x] **Étape 1 : lire une recette seule**

Dans `mobile/stores/recipes.ts`, ajouter un hook `useRecette(id)` calqué sur
`useRecipes` — mêmes champs, même compteur de génération, même message
`ERREUR_CHARGEMENT` — mais avec `.eq('id', id).maybeSingle()`.

- [x] **Étape 2 : écrire l'écran**

`mobile/app/(tabs)/recettes/[id].tsx` porte :

- la **photo en bandeau** de 220 points, ou l'aplat coloré à défaut ;
- une flèche de retour posée sur l'image, et un bouton **Modifier** ;
- le **nom** en 26 gras, la **description** en 15 `textMuted` ;
- un **réglage des parts** — `−`, la valeur, `+` — initialisé à
  `servings_default`, borné à 1 au minimum ;
- la liste des ingrédients : vignette du produit rattaché ou pastille neutre,
  nom, et quantité par `formatIngredientQty(quantitePourParts(q, parts), unite)` ;
- pour un ingrédient sans `product_id`, la mention **« non rattaché »** en
  `colors.textMuted`, suivie de l'explication en petit :
  « L'extension devra le chercher par son nom. »

**Le réglage des parts ne modifie pas la recette.** Il repart de
`servings_default` à chaque ouverture ; c'est une aide à la lecture.

États : chargement, erreur avec « Réessayer », recette introuvable avec
`<EtatVide titre="Recette introuvable">`.

- [x] **Étape 3 : vérifier**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
```

Attendu : aucune erreur, `# fail 0`.

- [x] **Étape 4 : commit**

```bash
git add "mobile/app/(tabs)/recettes/[id].tsx" mobile/stores/recipes.ts
git commit -m "feat: écran de détail d'une recette"
```

---

### Tâche 5 : le sélecteur d'ingrédient

**Fichiers :**
- Créer : `mobile/components/SelecteurIngredient.tsx`

**Interfaces :**
- Consomme : `filtrerCatalogue` ; `rechercherParNom`, `type FicheProduit` ;
  `useProducts`, `ajouterProduit` de `stores/products.ts`.
- Produit :
  `<SelecteurIngredient onChoisir={(choix: ChoixIngredient) => …} onFermer={() => …} />`
  avec
  `type ChoixIngredient = { name: string; product_id: string | null; unit: string; rayon: CleRayon }`

- [ ] **Étape 1 : écrire le composant**

Une feuille montant du bas, avec un champ de recherche en haut.

**Trois zones, dans cet ordre :**

1. **Ton catalogue** — `filtrerCatalogue(produits, requete)`, jusqu'à 8
   résultats, chacun avec sa vignette, son nom et sa marque. Choisir rend
   `{ name, product_id: p.id, unit: p.unit, rayon: rayonDepuisLibelle(p.category) }`.

2. **Open Food Facts** — un bouton « Chercher dans Open Food Facts », actif à
   partir de trois caractères. **Jamais déclenché à la frappe.** Pendant
   l'appel, un `ActivityIndicator` ; les trois issues de `rechercherParNom` ont
   chacune leur écran :
   - `trouve` : la liste des fiches, vignette et marque ;
   - `vide` : « Aucun résultat pour cette recherche. » ;
   - `indisponible` : « Open Food Facts est injoignable. Ton catalogue reste
     utilisable. » — pas un message d'erreur rouge, c'est un état ordinaire.

   Une fiche dont l'`ean13` est **déjà** dans le catalogue est marquée
   **« déjà au catalogue »** et, si on la choisit, rattache l'ingrédient au
   produit existant **sans rien insérer**.

   Sinon, choisir appelle `ajouterProduit(fiche)` puis rend le nouveau produit.
   Si l'insertion échoue, afficher `r.erreur` et ne pas fermer la feuille.

3. **Saisie libre** — un champ et un bouton « Ajouter “… ” à la main », qui rend
   `{ name: saisie, product_id: null, unit: 'unité', rayon: 'autre' }`.
   Placé en dernier et sans emphase : c'est ce chemin qui produit les
   ingrédients non rattachés.

- [ ] **Étape 2 : vérifier**

```bash
npx tsc --noEmit
```

Attendu : aucune erreur.

- [ ] **Étape 3 : commit**

```bash
git add mobile/components/SelecteurIngredient.tsx
git commit -m "feat: sélecteur d'ingrédient, catalogue puis Open Food Facts"
```

---

### Tâche 6 : la création réécrite

**Fichiers :**
- Modifier : `mobile/app/(tabs)/recettes/nouvelle.tsx`

**Interfaces :**
- Consomme : `SelecteurIngredient`, `valideBrouillon`, `UNITES`, `creerRecette`.

- [ ] **Étape 1 : réécrire l'écran**

Garder les champs **Nom** et **Nombre de parts**.

Remplacer les cartes d'ingrédient saisies à la main par une **liste des
ingrédients retenus** — vignette, nom, quantité par part, unité, rayon — et un
bouton **Ajouter un ingrédient** qui ouvre `<SelecteurIngredient>`.

Un ingrédient choisi arrive avec son unité et son rayon déjà remplis ; seule la
quantité par part reste à saisir, avec `1` par défaut.

Chaque ligne se retire par une croix. L'ordre suit l'ajout.

La validation et l'enregistrement ne changent pas : `valideBrouillon` d'abord,
son message affiché tel quel, puis `creerRecette`, puis `router.back()`.

- [ ] **Étape 2 : vérifier**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
```

Attendu : aucune erreur, `# fail 0`.

- [ ] **Étape 3 : commit**

```bash
git add "mobile/app/(tabs)/recettes/nouvelle.tsx"
git commit -m "feat: création d'une recette par recherche de produits"
```

---

### Tâche 7 : modifier et supprimer

**Fichiers :**
- Créer : `mobile/app/(tabs)/recettes/[id]/modifier.tsx` — voir la note de
  structure ci-dessous
- Modifier : `mobile/stores/recipes.ts`
- Modifier : `mobile/app/(tabs)/recettes/[id].tsx`

**Note de structure :** expo-router n'accepte pas à la fois `[id].tsx` et un
dossier `[id]/`. Déplacer le détail vers `[id]/index.tsx` et poser la
modification en `[id]/modifier.tsx`. Les adresses ne changent pas.

**Interfaces :**
- Produit :
  - `modifierRecette(id: string, b: Brouillon): Promise<{ ok: boolean; erreur?: string }>`
  - `supprimerRecette(id: string): Promise<{ ok: boolean; erreur?: string }>`

- [ ] **Étape 1 : écrire les deux opérations**

Dans `mobile/stores/recipes.ts` :

```ts
/**
 * Remplace une recette et ses ingrédients.
 *
 * Les ingrédients sont supprimés puis réinsérés, sans tentative de fusion :
 * rapprocher l'ancienne et la nouvelle liste demanderait des règles subtiles
 * et invérifiables d'un coup d'œil. Le remplacement est prévisible.
 *
 * Les deux opérations ne sont pas dans une transaction — PostgREST n'en expose
 * pas. En cas d'échec de la réinsertion, la recette resterait sans ingrédient :
 * on le signale explicitement plutôt que de laisser une coquille silencieuse.
 */
export async function modifierRecette(
  id: string,
  b: Brouillon,
): Promise<{ ok: boolean; erreur?: string }> {
  const { data: utilisateur } = await supabase.auth.getUser();
  const userId = utilisateur?.user?.id;
  if (!userId) return { ok: false, erreur: 'Session expirée. Reconnecte-toi.' };

  const { error: err1 } = await supabase
    .from('recipes')
    .update({ name: b.name.trim(), servings_default: b.servings_default })
    .eq('id', id);
  if (err1) {
    console.error('[modifierRecette]', err1);
    return { ok: false, erreur: "Impossible d'enregistrer la recette." };
  }

  const { error: err2 } = await supabase.from('recipe_ingredients').delete().eq('recipe_id', id);
  if (err2) {
    console.error('[modifierRecette:purge]', err2);
    return { ok: false, erreur: "Impossible de mettre à jour les ingrédients." };
  }

  const { error: err3 } = await supabase.from('recipe_ingredients').insert(
    b.ingredients.map((i) => ({
      recipe_id: id, user_id: userId,
      name: i.name.trim(), quantity_per_serving: i.quantity_per_serving,
      unit: i.unit, rayon: i.rayon, product_id: i.product_id,
    })),
  );
  if (err3) {
    console.error('[modifierRecette:ingredients]', err3);
    return {
      ok: false,
      erreur: "Les ingrédients n'ont pas pu être enregistrés. Rouvre la recette et réessaie.",
    };
  }
  return { ok: true };
}

/**
 * Supprime une recette. Ses ingrédients partent avec elle : la clé étrangère
 * `recipe_ingredients.recipe_id` est en ON DELETE CASCADE — vérifié le 22/08.
 */
export async function supprimerRecette(id: string): Promise<{ ok: boolean; erreur?: string }> {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) {
    console.error('[supprimerRecette]', error);
    return { ok: false, erreur: "Impossible de supprimer cette recette." };
  }
  return { ok: true };
}
```

- [ ] **Étape 2 : l'écran de modification**

`[id]/modifier.tsx` reprend l'écran de création — mêmes champs, même
`SelecteurIngredient`, même `valideBrouillon` — mais prérempli depuis la recette
et enregistrant par `modifierRecette`.

Le titre est **« Modifier la recette »**, le bouton **« Enregistrer »**.

- [ ] **Étape 3 : la suppression**

Sur le détail, un bouton **Supprimer** en `colors.danger`, discret, en bas de
l'écran. Il ouvre un `Alert.alert` :

- titre : « Supprimer cette recette ? »
- corps : « Ses ingrédients seront supprimés avec elle. Cette action est
  définitive. »
- boutons : « Annuler » (style `cancel`) et « Supprimer » (style `destructive`).

En cas de succès, `router.back()`. En cas d'échec, afficher `r.erreur`.

- [ ] **Étape 4 : vérifier**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
```

Attendu : aucune erreur, `# fail 0`.

- [ ] **Étape 5 : commit**

```bash
git add "mobile/app/(tabs)/recettes" mobile/stores/recipes.ts
git commit -m "feat: modification et suppression d'une recette"
```

---

## Phase 3 — Livrer la refonte

### Tâche 8 : livraison de la première phase

- [ ] **Étape 1 : vérification complète**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
npx expo-doctor
```

Attendu : aucune erreur TypeScript, `# fail 0`, expo-doctor sans échec autre que
les deux connus — CocoaPods local et l'avertissement CNG.

- [ ] **Étape 2 : vérifier le bundle, comme la CI**

```bash
EXPO_PUBLIC_SUPABASE_URL="https://qmymwicsgilhoihtfdjm.supabase.co" \
EXPO_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_PueJWmalqhZO0ctPu95GKQ_EaAgVulr" \
npx expo export --platform ios --output-dir /tmp/export-recettes
```

Attendu : `Exported:` sans erreur.

- [ ] **Étape 3 : pousser**

```bash
git push origin mobile/expo-scan
```

- [ ] **Étape 4 : suivre le build**

Avec `asc.mjs`, en **triant explicitement** : l'API ne rend pas les exécutions
de la plus récente à la plus ancienne, et `limit=1` renvoie la première, pas la
dernière — piège rencontré le 22/08.

```bash
ASC_KEY_ID=AYC86383MB \
ASC_ISSUER_ID=a725aaeb-78b3-44bb-80ee-018ca724ba5f \
ASC_KEY_PATH="$HOME/.appstoreconnect/AuthKey_AYC86383MB.p8" \
node asc.mjs "/v1/ciProducts/4ece9928-69b5-4a0a-a0cc-bdd408d09a57/buildRuns?limit=10"
```

En cas d'échec : récupérer les anomalies de l'action fautive, puis son artefact
de journal.

---

## Phase 4 — La photo

### Tâche 9 : le bucket de stockage

**Fichiers :**
- Créer : `supabase/migrations/0009_stockage_recettes.sql`

- [ ] **Étape 1 : écrire la migration**

```sql
-- Bucket des photos de recettes.
--
-- Une photo prise sur le téléphone donne une adresse `file://` locale : elle
-- ne survivrait ni à une réinstallation, ni au partage du foyer prévu plus
-- tard. Elle doit donc être déposée.
--
-- Le bucket est public en lecture : `products.image_url` porte déjà des
-- adresses publiques (Open Food Facts), et l'application les affiche par un
-- simple <Image>. Des adresses signées imposeraient de les renouveler à chaque
-- affichage, pour des photos de gratin.
--
-- L'écriture, elle, reste réservée au propriétaire : le premier segment du
-- chemin est son identifiant.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recettes', 'recettes', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "lecture publique des photos" on storage.objects;
create policy "lecture publique des photos" on storage.objects
  for select using (bucket_id = 'recettes');

drop policy if exists "depot par le proprietaire" on storage.objects;
create policy "depot par le proprietaire" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'recettes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "suppression par le proprietaire" on storage.objects;
create policy "suppression par le proprietaire" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'recettes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
```

- [ ] **Étape 2 : appliquer et vérifier**

Par l'outil MCP Supabase `apply_migration`, nom `stockage_recettes`. Puis :

```sql
select id, public, file_size_limit from storage.buckets where id = 'recettes';
select policyname from pg_policies where schemaname='storage' and tablename='objects';
```

Attendu : le bucket existe, public, limité à 5 Mo, et les trois politiques
apparaissent.

- [ ] **Étape 3 : commit**

```bash
git add supabase/migrations/0009_stockage_recettes.sql
git commit -m "feat: bucket de stockage des photos de recettes"
```

---

### Tâche 10 : la dépendance native

**Fichiers :**
- Modifier : `mobile/package.json`, `mobile/app.json`
- Modifier : `mobile/ios/` (régénéré)

- [ ] **Étape 1 : sauvegarder ce que prebuild pourrait emporter**

Le dossier `ios/` est versionné et contient `ci_scripts/ci_post_clone.sh`, sans
lequel Xcode Cloud ne sait plus compiler.

```bash
cp mobile/ios/ci_scripts/ci_post_clone.sh /tmp/ci_post_clone.sh.sauvegarde
shasum /tmp/ci_post_clone.sh.sauvegarde
```

- [ ] **Étape 2 : installer et régénérer**

```bash
cd mobile
npx expo install expo-image-picker
npx expo prebuild -p ios
```

**Ne jamais passer `--clean`** : il effacerait `ios/` en entier, `ci_scripts`
compris.

- [ ] **Étape 3 : contrôler ce qui a changé**

```bash
cd /Users/angel-assistant/app-saas/courses-app
git status --porcelain mobile/ios | head -20
ls -l mobile/ios/ci_scripts/ci_post_clone.sh
shasum mobile/ios/ci_scripts/ci_post_clone.sh /tmp/ci_post_clone.sh.sauvegarde
```

Attendu : le script est toujours présent, **exécutable** (`100755`), et de somme
identique à la sauvegarde. S'il a disparu ou changé, le restaurer :

```bash
mkdir -p mobile/ios/ci_scripts
cp /tmp/ci_post_clone.sh.sauvegarde mobile/ios/ci_scripts/ci_post_clone.sh
chmod +x mobile/ios/ci_scripts/ci_post_clone.sh
```

Vérifier aussi que `CFBundleURLSchemes` contient toujours `coursesapp`, sans
quoi le lien de récupération de mot de passe cesserait de fonctionner :

```bash
/usr/libexec/PlistBuddy -c "Print :CFBundleURLTypes" mobile/ios/Courses/Info.plist
```

- [ ] **Étape 4 : le texte d'autorisation**

Dans `mobile/app.json`, ajouter au tableau `plugins` :

```json
    [
      "expo-image-picker",
      {
        "photosPermission": "Choisis une photo pour illustrer ta recette."
      }
    ]
```

Le texte de l'appareil photo existe déjà, posé par le module expo-camera.

Comme `ios/` est versionné, `app.json` n'est plus la source de vérité —
vérifier que le texte est bien arrivé dans le plist :

```bash
/usr/libexec/PlistBuddy -c "Print :NSPhotoLibraryUsageDescription" mobile/ios/Courses/Info.plist
```

S'il manque, l'ajouter :

```bash
/usr/libexec/PlistBuddy -c "Add :NSPhotoLibraryUsageDescription string 'Choisis une photo pour illustrer ta recette.'" mobile/ios/Courses/Info.plist
```

- [ ] **Étape 5 : commit**

```bash
git add mobile/package.json mobile/package-lock.json mobile/app.json mobile/ios
git commit -m "chore: expo-image-picker et projet iOS régénéré"
```

---

### Tâche 11 : prendre et déposer la photo

**Fichiers :**
- Créer : `mobile/lib/photo-recette.ts`
- Modifier : `mobile/app/(tabs)/recettes/nouvelle.tsx` et `[id]/modifier.tsx`

**Interfaces :**
- Produit :
  - `choisirPhoto(source: 'appareil' | 'bibliotheque'): Promise<string | null>` — rend une adresse locale
  - `deposerPhoto(uriLocale: string): Promise<{ ok: boolean; url?: string; erreur?: string }>`

- [ ] **Étape 1 : écrire le module**

`choisirPhoto` demande l'autorisation, ouvre l'appareil ou la bibliothèque,
recadre en carré, compresse à `quality: 0.7`, et rend l'adresse locale ou `null`
si l'utilisateur annule.

`deposerPhoto` lit le fichier, l'envoie dans le bucket sous
`{user_id}/{uuid}.jpg`, et rend l'adresse publique.

**Le chemin doit commencer par l'identifiant de l'utilisateur** : la politique
d'écriture du bucket l'exige — `(storage.foldername(name))[1] = auth.uid()`.

Un refus d'autorisation n'est pas une erreur : `choisirPhoto` rend `null`, et
l'écran garde son aplat coloré.

- [ ] **Étape 2 : câbler les deux écrans**

Sur la création et la modification, au-dessus du champ **Nom** : la photo
retenue, ou l'aplat coloré, avec un bouton **Ajouter une photo** ouvrant le
choix entre **Prendre une photo** et **Choisir dans la photothèque**.

Le dépôt a lieu à l'enregistrement, pas au choix : inutile d'encombrer le
stockage si la recette n'est finalement pas enregistrée. Pendant le dépôt, le
bouton d'enregistrement affiche un `ActivityIndicator`.

Si le dépôt échoue, **la recette est enregistrée quand même**, sans photo, et le
message le dit : « La recette est enregistrée, mais la photo n'a pas pu être
envoyée. » Perdre une recette parce qu'une image n'est pas passée serait
disproportionné.

- [ ] **Étape 3 : vérifier**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
```

Attendu : aucune erreur, `# fail 0`.

- [ ] **Étape 4 : commit**

```bash
git add mobile/lib/photo-recette.ts "mobile/app/(tabs)/recettes"
git commit -m "feat: photo de recette prise sur l'appareil et déposée sur Supabase"
```

---

### Tâche 12 : livraison de la seconde phase

- [ ] **Étape 1 : vérification complète**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
npx expo-doctor
EXPO_PUBLIC_SUPABASE_URL="https://qmymwicsgilhoihtfdjm.supabase.co" \
EXPO_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_PueJWmalqhZO0ctPu95GKQ_EaAgVulr" \
npx expo export --platform ios --output-dir /tmp/export-photo
```

- [ ] **Étape 2 : pousser et suivre**

```bash
git push origin mobile/expo-scan
```

Ce build est le premier après un `prebuild` : surveiller particulièrement la
phase `ci_post_clone.sh` et l'étape `pod install`, qui compile un pod de plus.

- [ ] **Étape 3 : éprouver sur l'appareil**

1. La liste affiche les cartes photo ; une recette sans photo montre son aplat.
2. Ouvrir une recette : les ingrédients apparaissent, les quantités suivent le
   réglage des parts.
3. Créer une recette avec deux ingrédients, l'un pris au catalogue, l'autre dans
   Open Food Facts — vérifier qu'il entre bien au catalogue :
   `select name, ean13, nutriscore from public.products order by created_at desc limit 3;`
4. Ajouter une photo, enregistrer, vérifier qu'elle s'affiche après un
   redémarrage de l'application.
5. Modifier la recette, puis la supprimer.

## Ce que ce plan ne fait pas

- L'import d'une recette par lien ou par photo.
- Le compte et le partage du foyer.
- Le bandeau de suivi persistant.
- La fusion fine des ingrédients à la modification.
