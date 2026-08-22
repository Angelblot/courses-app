# Import de recettes par lien — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour dérouler ce plan tâche par tâche. Les étapes
> emploient la syntaxe à cases (`- [ ]`).

**But :** coller l'adresse d'une recette et la créer, après avoir montré ce qu'on
en a compris.

**Architecture :** la fonction Edge ne fait qu'un appel réseau et une découpe de
balises — le strict minimum de ce qui n'est pas testable sous Node. Tout le
reste — extraction de la recette parmi les blocs, lecture des parts, analyse des
lignes d'ingrédients — vit dans l'application en fonctions pures.

**Pile :** Supabase Edge Functions (Deno), Expo SDK 57, expo-router,
`node:test`.

**Spécification :** `docs/superpowers/specs/2026-08-22-import-recettes-design.md`

## Contraintes globales

- **Tests : Node ≥ 22.** Depuis `mobile/` :
  `/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs`
- **Aucun déguisement.** L'agent employé est `courses-app/1.0`, jamais une
  chaîne de navigateur : vérifié le 22/08, un agent honnête obtient la même
  réponse.
- **Aucun raclage de HTML.** Sans bloc `schema.org/Recipe`, l'import échoue avec
  un message clair.
- **La logique pure ne doit jamais importer Supabase ni React Native.**
- **Aucune nouvelle dépendance.**
- **Zéro emoji.** Thème clair, jetons de `lib/theme.ts`, messages en français.
- **Ne rien pousser avant la tâche 4.**
- **Projet Supabase :** `qmymwicsgilhoihtfdjm`.

---

### Tâche 1 : analyser une recette

**Fichiers :**
- Créer : `mobile/lib/import-recette.ts`
- Test : `mobile/lib/import-recette.test.mjs`

**Interfaces :**
- Consomme : `UNITES` de `lib/recette-brouillon.ts`.
- Produit :
  - `analyserLigne(ligne: string): LigneAnalysee`
  - `type LigneAnalysee = { quantite: number; unite: string; nom: string; aVerifier: boolean }`
  - `lireParts(brut: unknown): number`
  - `extraireRecette(blocs: string[]): RecetteImportee | null`
  - `type RecetteImportee = { nom: string; parts: number; image: string | null; ingredients: string[] }`

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `mobile/lib/import-recette.test.mjs` :

```js
/**
 * Analyse d'une recette importée. Fonctions pures, sans réseau.
 * Lancer : node --test mobile/lib/import-recette.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyserLigne, lireParts, extraireRecette } from './import-recette.ts';

// Lignes réellement rendues par Marmiton, mesurées le 22/08.
test('une quantité, une unité connue, un nom', () => {
  assert.deepEqual(analyserLigne('600 g de bourguignon'),
    { quantite: 600, unite: 'g', nom: 'bourguignon', aVerifier: false });
});

test('une unité inconnue est retenue quand elle précède « de »', () => {
  assert.deepEqual(analyserLigne('1 bouteille de vin rouge assez bon'),
    { quantite: 1, unite: 'bouteille', nom: 'vin rouge assez bon', aVerifier: false });
});

test('sans unité, la quantité compte des exemplaires', () => {
  assert.deepEqual(analyserLigne('4 oignons'),
    { quantite: 4, unite: 'unité', nom: 'oignons', aVerifier: false });
});

test('un mot seul après le nombre ne devient pas une unité', () => {
  // Sans la règle du « de », « bouquet » deviendrait l'unité et le nom serait
  // vide.
  assert.deepEqual(analyserLigne('1 bouquet garni'),
    { quantite: 1, unite: 'unité', nom: 'bouquet garni', aVerifier: false });
});

test('une ligne sans quantité est signalée, jamais inventée', () => {
  assert.deepEqual(analyserLigne('sel'),
    { quantite: 0, unite: 'unité', nom: 'sel', aVerifier: true });
  assert.equal(analyserLigne('poivre').aVerifier, true);
});

test("l'élision est retirée du nom", () => {
  const r = analyserLigne("2 cuillères à soupe d'huile d'olive");
  assert.equal(r.quantite, 2);
  assert.equal(r.unite, 'cuillère à soupe');
  assert.equal(r.nom, "huile d'olive");
});

test('les fractions et les décimales à la française sont comprises', () => {
  assert.equal(analyserLigne('1/2 citron').quantite, 0.5);
  assert.equal(analyserLigne('1,5 kg de pommes de terre').quantite, 1.5);
  assert.equal(analyserLigne('1.5 kg de pommes de terre').quantite, 1.5);
});

test('une ligne vide ne produit pas un ingrédient fantôme', () => {
  assert.equal(analyserLigne('').nom, '');
  assert.equal(analyserLigne('   ').aVerifier, true);
});

test('le nombre de parts se lit sous toutes ses formes', () => {
  assert.equal(lireParts('4 personnes'), 4);
  assert.equal(lireParts(6), 6);
  assert.equal(lireParts(['8 parts']), 8);
  assert.equal(lireParts('pour 2 gourmands'), 2);
});

test('un nombre de parts illisible retombe sur 4', () => {
  // Inventer 1 ferait des quantités quatre fois trop petites sans que rien ne
  // le signale.
  assert.equal(lireParts(null), 4);
  assert.equal(lireParts('quelques'), 4);
  assert.equal(lireParts(0), 4);
});

const BLOC_SIMPLE = JSON.stringify({
  '@type': 'Recipe',
  name: 'Gratin',
  recipeYield: '4 personnes',
  image: 'https://exemple.test/g.jpg',
  recipeIngredient: ['600 g de pommes de terre', 'sel'],
});

test('la recette se trouve dans un bloc simple', () => {
  const r = extraireRecette([BLOC_SIMPLE]);
  assert.equal(r.nom, 'Gratin');
  assert.equal(r.parts, 4);
  assert.equal(r.image, 'https://exemple.test/g.jpg');
  assert.equal(r.ingredients.length, 2);
});

test('la recette se trouve dans un tableau', () => {
  const r = extraireRecette([JSON.stringify([{ '@type': 'WebPage' }, JSON.parse(BLOC_SIMPLE)])]);
  assert.equal(r.nom, 'Gratin');
});

test('la recette se trouve dans un @graph', () => {
  const r = extraireRecette([JSON.stringify({ '@graph': [JSON.parse(BLOC_SIMPLE)] })]);
  assert.equal(r.nom, 'Gratin');
});

test('un bloc malformé est ignoré, pas fatal', () => {
  const r = extraireRecette(['{ pas du json', BLOC_SIMPLE]);
  assert.equal(r.nom, 'Gratin');
});

test("l'absence de recette se dit, elle ne s'invente pas", () => {
  assert.equal(extraireRecette([]), null);
  assert.equal(extraireRecette([JSON.stringify({ '@type': 'Article' })]), null);
  assert.equal(extraireRecette(['{ cassé']), null);
});

test("l'image peut être un objet ou un tableau", () => {
  const avecObjet = extraireRecette([JSON.stringify({
    '@type': 'Recipe', name: 'X', recipeIngredient: ['sel'],
    image: { url: 'https://exemple.test/o.jpg' },
  })]);
  assert.equal(avecObjet.image, 'https://exemple.test/o.jpg');

  const avecTableau = extraireRecette([JSON.stringify({
    '@type': 'Recipe', name: 'X', recipeIngredient: ['sel'],
    image: ['https://exemple.test/t.jpg'],
  })]);
  assert.equal(avecTableau.image, 'https://exemple.test/t.jpg');
});
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/import-recette.test.mjs
```

Attendu : ÉCHEC, `ERR_MODULE_NOT_FOUND` sur `./import-recette.ts`.

- [ ] **Étape 3 : écrire le module**

Créer `mobile/lib/import-recette.ts` :

```ts
/**
 * Analyse d'une recette importée depuis un site de cuisine.
 *
 * Aucun import de Supabase ni de React Native : ces fonctions doivent rester
 * exécutables sous `node --test`. C'est toute la raison pour laquelle la
 * fonction Edge ne fait que récupérer la page — elle ne l'interprète pas.
 */

export type LigneAnalysee = {
  quantite: number;
  unite: string;
  nom: string;
  /** Vrai quand la ligne ne portait aucune quantité : « sel », « poivre ». */
  aVerifier: boolean;
};

export type RecetteImportee = {
  nom: string;
  parts: number;
  image: string | null;
  ingredients: string[];
};

/**
 * Unités reconnues, de la plus longue à la plus courte.
 *
 * L'ordre compte : sans lui, « cuillère » l'emporterait sur « cuillère à
 * soupe » et laisserait « à soupe » dans le nom de l'ingrédient.
 */
const UNITES_CONNUES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^cuill[eè]res?\s+à\s+soupe\b/i, 'cuillère à soupe'],
  [/^cuill[eè]res?\s+à\s+caf[ée]\b/i, 'cuillère à café'],
  [/^kilogrammes?\b/i, 'kg'], [/^kg\b/i, 'kg'],
  [/^grammes?\b/i, 'g'], [/^gr?\b/i, 'g'],
  [/^millilitres?\b/i, 'ml'], [/^ml\b/i, 'ml'],
  [/^centilitres?\b/i, 'cl'], [/^cl\b/i, 'cl'],
  [/^litres?\b/i, 'L'], [/^l\b/i, 'L'],
  [/^pinc[ée]es?\b/i, 'pincée'],
  [/^gousses?\b/i, 'gousse'],
  [/^tranches?\b/i, 'tranche'],
  [/^sachets?\b/i, 'sachet'],
  [/^branches?\b/i, 'branche'],
  [/^bo[iî]tes?\b/i, 'boîte'],
  [/^paquets?\b/i, 'paquet'],
];

/** Retire l'article ou l'élision qui ouvre un nom : « de », « du », « d' ». */
const sansArticle = (s: string) =>
  s.replace(/^(?:d['’]|de\s+la\s+|de\s+l['’]|des\s+|du\s+|de\s+)/i, '').trim();

/**
 * Découpe une ligne d'ingrédient en quantité, unité et nom.
 *
 * Une ligne sans quantité rend 0 et se signale : « sel » n'est pas « 1 unité
 * de sel », et inventer une quantité la ferait remonter telle quelle jusqu'au
 * panier.
 */
export function analyserLigne(ligne: string): LigneAnalysee {
  const brut = (ligne ?? '').replace(/\s+/g, ' ').trim();
  if (!brut) return { quantite: 0, unite: 'unité', nom: '', aVerifier: true };

  const m = brut.match(/^(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) {
    return { quantite: 0, unite: 'unité', nom: brut, aVerifier: true };
  }

  const texteQuantite = m[1];
  let reste = m[2].trim();

  let quantite: number;
  if (texteQuantite.includes('/')) {
    const [a, b] = texteQuantite.split('/').map((x) => Number(x.trim()));
    quantite = b ? a / b : 0;
  } else {
    quantite = Number(texteQuantite.replace(',', '.'));
  }

  for (const [motif, unite] of UNITES_CONNUES) {
    const trouve = reste.match(motif);
    if (trouve) {
      return {
        quantite,
        unite,
        nom: sansArticle(reste.slice(trouve[0].length)),
        aVerifier: false,
      };
    }
  }

  // Une unité inconnue n'est retenue que si elle précède un « de » : sans
  // cette règle, « 4 oignons » ferait de « oignons » une unité et laisserait
  // un nom vide.
  const avecDe = reste.match(/^(\S+)\s+(?:d['’]|de\s+la\s+|de\s+l['’]|des\s+|du\s+|de\s+)(.+)$/i);
  if (avecDe) {
    return { quantite, unite: avecDe[1].toLowerCase(), nom: avecDe[2].trim(), aVerifier: false };
  }

  return { quantite, unite: 'unité', nom: sansArticle(reste), aVerifier: false };
}

/**
 * Nombre de parts, quelle que soit la forme rendue par le site.
 *
 * `recipeYield` vaut souvent `"4 personnes"`, parfois un nombre, parfois un
 * tableau. À défaut on rend 4 : inventer 1 ferait des quantités quatre fois
 * trop petites sans que rien ne le signale.
 */
export function lireParts(brut: unknown): number {
  const valeur = Array.isArray(brut) ? brut[0] : brut;
  if (typeof valeur === 'number' && Number.isFinite(valeur) && valeur > 0) {
    return Math.round(valeur);
  }
  const n = String(valeur ?? '').match(/\d+/);
  const parts = n ? Number(n[0]) : 0;
  return parts > 0 ? parts : 4;
}

/** Première adresse d'image, que le site la rende en chaîne, objet ou tableau. */
function lireImage(brut: unknown): string | null {
  const valeur = Array.isArray(brut) ? brut[0] : brut;
  if (typeof valeur === 'string') return valeur || null;
  if (valeur && typeof valeur === 'object') {
    const url = (valeur as { url?: unknown }).url;
    return typeof url === 'string' ? url : null;
  }
  return null;
}

const estRecette = (n: unknown): boolean => {
  const t = (n as { '@type'?: unknown })?.['@type'];
  return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
};

/**
 * Trouve la recette parmi les blocs `application/ld+json` d'une page.
 *
 * Les sites l'enveloppent de trois façons : un objet seul, un tableau, ou un
 * `@graph`. Un bloc illisible est ignoré plutôt que fatal — une page en porte
 * souvent plusieurs, et un seul cassé ne doit pas condamner l'import.
 */
export function extraireRecette(blocs: string[]): RecetteImportee | null {
  for (const bloc of blocs ?? []) {
    let racine: unknown;
    try {
      racine = JSON.parse(bloc);
    } catch {
      continue;
    }
    const candidats: unknown[] = Array.isArray(racine)
      ? racine
      : (racine as { '@graph'?: unknown[] })?.['@graph'] ?? [racine];

    for (const n of candidats) {
      if (!estRecette(n)) continue;
      const r = n as Record<string, unknown>;
      const ingredients = (r.recipeIngredient as unknown[] | undefined) ?? [];
      return {
        nom: String(r.name ?? '').trim(),
        parts: lireParts(r.recipeYield),
        image: lireImage(r.image),
        ingredients: ingredients.map((x) => String(x)).filter((x) => x.trim()),
      };
    }
  }
  return null;
}
```

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
npx tsc --noEmit
```

Attendu : `# fail 0`, aucune erreur TypeScript.

- [ ] **Étape 5 : commit**

```bash
git add mobile/lib/import-recette.ts mobile/lib/import-recette.test.mjs
git commit -m "feat: analyse d'une recette importée"
```

---

### Tâche 2 : la fonction de récupération

**Fichiers :**
- Créer : `supabase/functions/importer-recette/index.ts`

**Interfaces :**
- Produit : une fonction Edge appelée par
  `supabase.functions.invoke('importer-recette', { body: { url } })`, rendant
  `{ ok: true, blocs: string[] }` ou `{ ok: false, erreur: string }`.

- [ ] **Étape 1 : écrire la fonction**

Créer `supabase/functions/importer-recette/index.ts` :

```ts
/**
 * Récupère une page de recette et rend ses blocs `application/ld+json`.
 *
 * Elle ne les interprète pas : l'extraction et l'analyse vivent dans
 * l'application, où elles sont testables sous Node. Il ne reste ici que ce
 * qu'on ne peut pas tester ainsi — un appel réseau et une découpe de balises.
 *
 * L'agent est honnête. Vérifié le 22/08 : une chaîne de navigateur n'apporte
 * rien, la réponse est identique. Le projet ne déguise pas ses accès, ici pas
 * plus qu'ailleurs.
 */
const AGENT = 'courses-app/1.0 (application familiale de courses; lecture de donnees schema.org)';
const DELAI_MS = 12_000;
/** Au-delà, on ne télécharge pas : une page de recette pèse moins de 2 Mo. */
const TAILLE_MAX = 2_000_000;

const reponse = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reponse({ ok: false, erreur: 'Méthode refusée.' }, 405);

  let adresse = '';
  try {
    adresse = String((await req.json())?.url ?? '').trim();
  } catch {
    return reponse({ ok: false, erreur: 'Requête illisible.' }, 400);
  }

  let cible: URL;
  try {
    cible = new URL(adresse);
  } catch {
    return reponse({ ok: false, erreur: "Cette adresse n'est pas valide." }, 400);
  }
  if (cible.protocol !== 'https:' && cible.protocol !== 'http:') {
    return reponse({ ok: false, erreur: 'Seules les adresses web sont acceptées.' }, 400);
  }

  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    const r = await fetch(cible.toString(), {
      headers: { 'User-Agent': AGENT, Accept: 'text/html' },
      redirect: 'follow',
      signal: controleur.signal,
    });
    if (!r.ok) {
      return reponse({ ok: false, erreur: `La page a répondu ${r.status}.` }, 400);
    }
    const html = (await r.text()).slice(0, TAILLE_MAX);

    const blocs = [...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    )].map((m) => m[1].trim()).filter(Boolean);

    if (blocs.length === 0) {
      return reponse({
        ok: false,
        erreur: "Cette page ne publie pas sa recette dans un format lisible.",
      }, 400);
    }
    return reponse({ ok: true, blocs });
  } catch (e) {
    console.error('[importer-recette]', String(e));
    return reponse({ ok: false, erreur: "La page n'a pas pu être récupérée." }, 400);
  } finally {
    clearTimeout(minuteur);
  }
});
```

- [ ] **Étape 2 : déployer**

Par l'outil MCP Supabase `deploy_edge_function`, projet `qmymwicsgilhoihtfdjm`,
nom `importer-recette`, `verify_jwt` à **vrai** — seul un utilisateur connecté
doit pouvoir s'en servir.

- [ ] **Étape 3 : éprouver sur une page réelle**

Appeler la fonction déployée avec l'adresse
`https://www.marmiton.org/recettes/recette_gratin-dauphinois-rapide_18889.aspx`,
en fournissant un jeton d'utilisateur.

Attendu : `ok: true` et au moins un bloc. Vérifier ensuite, en local, que
`extraireRecette` sur ces blocs rend bien un nom et des ingrédients — c'est le
raccordement des deux moitiés, et le seul endroit où il peut casser.

- [ ] **Étape 4 : commit**

```bash
git add supabase/functions/importer-recette
git commit -m "feat: récupération d'une page de recette"
```

---

### Tâche 3 : l'écran d'import

**Fichiers :**
- Créer : `mobile/app/(tabs)/recettes/importer.tsx`
- Modifier : `mobile/app/(tabs)/recettes/index.tsx`
- Modifier : `mobile/stores/recipes.ts`

**Interfaces :**
- Consomme : `analyserLigne`, `extraireRecette` ; `creerRecette`,
  `valideBrouillon`, `UNITES` ; `normalizeProductType` ; `useProducts` ;
  `SelecteurRayon`, `libelleRayon`.
- Produit : `recupererRecette(url: string): Promise<{ ok: boolean; recette?: RecetteImportee; erreur?: string }>` dans `stores/recipes.ts`.

- [ ] **Étape 1 : l'appel à la fonction**

Ajouter à `mobile/stores/recipes.ts` :

```ts
/**
 * Récupère une recette depuis une adresse.
 *
 * La fonction Edge ne rend que les blocs bruts ; l'extraction se fait ici, par
 * une fonction pure et testée.
 */
export async function recupererRecette(
  url: string,
): Promise<{ ok: boolean; recette?: RecetteImportee; erreur?: string }> {
  const { data, error } = await supabase.functions.invoke('importer-recette', {
    body: { url: url.trim() },
  });
  if (error) {
    console.error('[recupererRecette]', error);
    const message = (data as { erreur?: string } | null)?.erreur;
    return { ok: false, erreur: message ?? "La page n'a pas pu être récupérée." };
  }
  const r = data as { ok?: boolean; blocs?: string[]; erreur?: string } | null;
  if (!r?.ok) return { ok: false, erreur: r?.erreur ?? "La recette n'a pas pu être lue." };

  const recette = extraireRecette(r.blocs ?? []);
  if (!recette || !recette.nom) {
    return { ok: false, erreur: "Cette page ne publie pas sa recette dans un format lisible." };
  }
  return { ok: true, recette };
}
```

avec les imports `import { extraireRecette, type RecetteImportee } from '../lib/import-recette.ts';`

- [ ] **Étape 2 : l'écran**

Créer `mobile/app/(tabs)/recettes/importer.tsx`, en deux temps.

**Avant l'import :** un champ d'adresse, un bouton **Importer**, et une phrase
d'aide — « Colle l'adresse d'une recette. Elle sera lue, pas enregistrée : tu
verras ce qu'on en a compris avant de valider. » Pendant l'appel, un
`ActivityIndicator`.

**Après l'import, l'aperçu :** la photo si le site en donne une, le nom et le
nombre de parts, tous deux modifiables, puis chaque ingrédient issu de
`analyserLigne` avec sa quantité, son unité et son nom, tous modifiables.

Un ingrédient dont `aVerifier` est vrai porte la mention **« quantité à
vérifier »** en `colors.danger`, et un compte global le rappelle en tête :
« 2 ingrédients sans quantité. »

Chaque ingrédient est rattaché au catalogue quand c'est possible :
`normalizeProductType(nom)` puis recherche d'un produit du même type. Le rayon
suit celui du produit trouvé, ou `autre`, et reste modifiable par
`<SelecteurRayon>`.

Le bouton **Enregistrer** passe par `valideBrouillon` puis `creerRecette`, comme
la création manuelle, et revient à la liste.

- [ ] **Étape 3 : le point d'entrée**

Dans `mobile/app/(tabs)/recettes/index.tsx`, ajouter à côté de
**Nouvelle recette** un second bouton **Importer un lien**, en style secondaire,
menant à `/recettes/importer`.

- [ ] **Étape 4 : régénérer les types de routes**

```bash
AVANT=$(stat -f %m .expo/types/router.d.ts)
npx expo start --port 8099 > /tmp/expo-types.log 2>&1 &
PID=$!
for i in $(seq 1 40); do
  A=$(stat -f %m .expo/types/router.d.ts 2>/dev/null || echo 0)
  [ "$A" != "$AVANT" ] && break
  perl -e 'select(undef,undef,undef,0.5)'
done
kill $PID 2>/dev/null
grep -c "importer" .expo/types/router.d.ts
```

Attendu : un compte supérieur à zéro.

- [ ] **Étape 5 : vérifier**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
```

Attendu : aucune erreur, `# fail 0`.

- [ ] **Étape 6 : commit**

```bash
git add "mobile/app/(tabs)/recettes" mobile/stores/recipes.ts
git commit -m "feat: écran d'import d'une recette par lien"
```

---

### Tâche 4 : livrer

- [ ] **Étape 1 : vérification complète**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
npx expo-doctor
EXPO_PUBLIC_SUPABASE_URL="https://qmymwicsgilhoihtfdjm.supabase.co" \
EXPO_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_PueJWmalqhZO0ctPu95GKQ_EaAgVulr" \
npx expo export --platform ios --output-dir /tmp/export-import
```

Attendu : aucune erreur TypeScript, `# fail 0`, expo-doctor sans échec autre que
les deux connus, et `Exported:`.

- [ ] **Étape 2 : pousser**

```bash
git push origin mobile/expo-scan
```

- [ ] **Étape 3 : suivre le build**

**Trier côté serveur**, comme le documente `mobile/XCODE_CLOUD.md` :

```bash
ASC_KEY_ID=AYC86383MB \
ASC_ISSUER_ID=a725aaeb-78b3-44bb-80ee-018ca724ba5f \
ASC_KEY_PATH="$HOME/.appstoreconnect/AuthKey_AYC86383MB.p8" \
node asc.mjs "/v1/ciProducts/4ece9928-69b5-4a0a-a0cc-bdd408d09a57/buildRuns?limit=3&sort=-number"
```

- [ ] **Étape 4 : éprouver sur l'appareil**

1. Coller l'adresse d'une recette Marmiton : l'aperçu s'affiche.
2. Vérifier que les quantités sont justes, et que « sel » et « poivre » sont
   bien signalés plutôt qu'inventés.
3. Corriger un ingrédient, enregistrer, et vérifier que la recette apparaît dans
   la liste avec sa photo.
4. L'ouvrir : les ingrédients rattachés portent leur vignette.
5. Coller l'adresse d'une page qui n'est pas une recette : le message doit être
   clair, sans trace technique.

## Ce que ce plan ne fait pas

- Le raclage de HTML pour les pages sans `schema.org/Recipe`.
- Le scan d'une fiche par OCR.
- L'import depuis le presse-papiers.
- Le retrait de FastAPI et du front web.
