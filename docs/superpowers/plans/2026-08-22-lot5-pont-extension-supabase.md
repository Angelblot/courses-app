# Lot 5 — Pont extension ↔ Supabase — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour dérouler ce plan tâche par tâche. Les étapes
> emploient la syntaxe à cases (`- [ ]`).

**But :** donner à l'extension de quoi relever les listes écrites par le wizard
dans `cart_jobs`, remplir les paniers des deux enseignes, et rendre compte au
téléphone en temps réel.

**Architecture :** l'extension parle à Supabase par appels REST directs, sans
bundler, et se réveille par `chrome.alarms` — un service worker Manifest V3 ne
survit pas assez longtemps pour tenir un abonnement temps réel. Le temps réel
reste employé côté téléphone, où React Native n'a pas cette contrainte. La
logique pure est séparée des appels réseau pour rester testable.

**Pile :** Chrome Manifest V3, modules ES sans compilation, API REST Supabase,
Expo SDK 57, `@supabase/supabase-js` 2.112 côté mobile, `node:test`.

**Spécification :** `docs/superpowers/specs/2026-08-22-lot5-pont-extension-supabase-design.md`

## Contraintes globales

- **Aucun bundler dans l'extension.** Modules ES chargés tels quels ; elle doit
  rester installable en dossier non empaqueté. Pas de `npm install` côté
  `extension/`.
- **Tests mobile : Node ≥ 22.** Depuis `mobile/` :
  `/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs`
- **Tests extension :** depuis `extension/` :
  `/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test *.test.mjs`
- **La logique pure ne doit jamais importer `chrome.*` ni le client Supabase.**
  Un module qui touche au réseau ou au stockage n'est pas testable sous Node —
  leçon du lot 4, où `construireItems` a dû être déplacée pour cette raison.
- **Aucun identifiant de drive n'est stocké**, ni maintenant ni plus tard.
- **Rien n'est construit pour masquer le caractère automatisé du navigateur.**
  Sur un challenge, l'extension s'arrête et rend la main.
- **L'extension ne valide jamais de commande** et ne paie rien.
- **Rien ne démarre sans un clic.** L'alarme allume la pastille ; elle ne lance
  jamais un remplissage d'elle-même.
- **Zéro emoji dans l'interface**, thème clair, messages d'erreur en français.
- **Ne rien pousser avant la tâche 9.** Xcode Cloud surveille `mobile/` sur
  `mobile/expo-scan` avec « Auto-cancel Builds ».
- **Clé publiable Supabase** (publique par conception, RLS assure l'isolation) :
  `sb_publishable_PueJWmalqhZO0ctPu95GKQ_EaAgVulr`
  URL : `https://qmymwicsgilhoihtfdjm.supabase.co`

---

## Phase 1 — Base et données

### Tâche 1 : ouvrir l'écriture des travaux

**Fichiers :**
- Créer : `supabase/migrations/0008_cart_jobs_avancement.sql`

**Interfaces :**
- Produit : une politique RLS permettant au propriétaire de faire avancer son
  travail sans pouvoir en altérer le contenu.

- [ ] **Étape 1 : constater le blocage actuel**

Par l'outil MCP Supabase, projet `qmymwicsgilhoihtfdjm` :

```sql
select policyname, cmd, qual, with_check from pg_policies
where schemaname='public' and tablename='cart_jobs';
```

Attendu : une seule politique `UPDATE`, `cancel own pending jobs`, dont le
`with_check` impose `status = 'cancelled'`. L'extension ne peut donc écrire ni
`progress`, ni `results`, ni un statut d'avancement. **Copier ce résultat dans
le message de commit.**

- [ ] **Étape 2 : écrire la migration**

Créer `supabase/migrations/0008_cart_jobs_avancement.sql` :

```sql
-- Autorise le propriétaire à faire avancer son propre travail de remplissage.
--
-- Jusqu'ici la seule politique d'écriture permettait de passer un travail de
-- « pending » à « cancelled », et rien d'autre : l'extension ne pouvait écrire
-- ni sa progression, ni ses résultats. Elle aurait relevé les listes sans
-- jamais pouvoir rendre compte.
--
-- La politique interdit de modifier `items` et `user_id`. Une liste validée sur
-- le téléphone ne doit pas pouvoir changer sous les pieds de son auteur : ce
-- qui part au panier doit être exactement ce qui a été relu au récapitulatif.

create or replace function public.cart_job_contenu_intact()
returns trigger
language plpgsql
as $$
begin
  if new.items is distinct from old.items then
    raise exception 'items est immuable une fois le travail créé';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id est immuable';
  end if;
  return new;
end;
$$;

drop trigger if exists cart_jobs_contenu_intact on public.cart_jobs;
create trigger cart_jobs_contenu_intact
  before update on public.cart_jobs
  for each row execute function public.cart_job_contenu_intact();

drop policy if exists "advance own jobs" on public.cart_jobs;
create policy "advance own jobs" on public.cart_jobs
  for update
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and status in ('claimed', 'running', 'needs_action', 'done', 'failed')
  );

comment on policy "advance own jobs" on public.cart_jobs is
  'Permet à l''extension de faire avancer un travail. L''immuabilité de items est assurée par le déclencheur cart_jobs_contenu_intact.';
```

- [ ] **Étape 3 : appliquer**

Par l'outil MCP Supabase `apply_migration`, projet `qmymwicsgilhoihtfdjm`, nom
`cart_jobs_avancement`.

- [ ] **Étape 4 : vérifier que l'immuabilité tient**

```sql
select policyname, cmd from pg_policies
where schemaname='public' and tablename='cart_jobs' order by policyname;
```

Attendu : trois politiques au moins, dont `advance own jobs` et
`cancel own pending jobs`.

Puis vérifier le déclencheur sur une ligne réelle :

```sql
select id from public.cart_jobs order by created_at desc limit 1;
```

S'il existe une ligne, tenter d'en modifier `items` doit échouer :

```sql
update public.cart_jobs set items = '[]'::jsonb
where id = (select id from public.cart_jobs order by created_at desc limit 1);
```

Attendu : `ERROR: items est immuable une fois le travail créé`. Si la commande
réussit, le déclencheur n'est pas actif — ne pas poursuivre.

S'il n'existe aucune ligne, noter que la vérification est reportée à la
tâche 9, étape 6.

- [ ] **Étape 5 : commit**

```bash
git add supabase/migrations/0008_cart_jobs_avancement.sql
git commit -m "feat: l'extension peut faire avancer un travail sans altérer sa liste"
```

---

### Tâche 2 : `product_id` dans la liste envoyée

**Fichiers :**
- Modifier : `mobile/lib/consolidation.ts`
- Test : `mobile/lib/consolidation.test.mjs`

**Interfaces :**
- Produit : `LigneConsolidee` et `ItemPanier` gagnent `product_id: string | null`.

- [ ] **Étape 1 : écrire les tests qui échouent**

Ajouter à la fin de `mobile/lib/consolidation.test.mjs` :

```js
test("la ligne porte l'identifiant du produit du quotidien", () => {
  const items = buildConsolidatedItems({
    recipes: [], selectedRecipes: {},
    quotidien: { p1: 'needed' }, quotidienQty: { p1: 2 }, extras: [],
    products: [{ id: 'p1', name: 'Lait', unit: 'unité', category: 'pls', ean13: '123' }],
  });
  assert.equal(items[0].product_id, 'p1');
});

test("deux origines de même nom mais d'identifiants différents effacent l'identifiant", () => {
  // La fusion se fait par nom et unité. Garder le premier identifiant venu
  // ferait enregistrer une équivalence sur le mauvais produit, et cette erreur
  // se rejouerait à chaque commande. Mieux vaut ne rien mémoriser.
  const items = buildConsolidatedItems({
    recipes: [{ id: 'r1', name: 'R', ingredients: [
      { name: 'Lait', quantity_per_serving: 1, unit: 'unité', rayon: 'pls', product_id: 'p2' },
    ] }],
    selectedRecipes: { r1: 1 },
    quotidien: { p1: 'needed' }, quotidienQty: { p1: 1 }, extras: [],
    products: [{ id: 'p1', name: 'Lait', unit: 'unité', category: 'pls' }],
  });
  const lait = items.find((i) => i.name === 'Lait');
  assert.equal(lait.product_id, null);
});

test("un ajout manuel n'a aucun identifiant de produit", () => {
  const items = buildConsolidatedItems({
    recipes: [], selectedRecipes: {}, quotidien: {}, quotidienQty: {},
    extras: [{ id: 'e1', name: 'Piles AA', quantity: 1, unit: 'unité', rayon: 'maison' }],
    products: [],
  });
  assert.equal(items[0].product_id, null);
});

test("l'article de panier transporte l'identifiant du produit", () => {
  const items = construireItems([
    { key: 'a', name: 'Lait', unit: 'unité', rayon: 'pls',
      totalQuantity: 2, ean13: '123', product_id: 'p1', sources: [] },
  ]);
  assert.equal(items[0].product_id, 'p1');
});
```

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

Depuis `mobile/` :

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/consolidation.test.mjs
```

Attendu : ÉCHEC, `undefined !== 'p1'`.

- [ ] **Étape 3 : écrire l'implémentation**

Dans `mobile/lib/consolidation.ts` :

Ajouter le champ au type `LigneConsolidee`, après `ean13` :

```ts
  /**
   * Produit du catalogue dont cette ligne provient, quand l'origine est
   * certaine. `null` dès que deux origines d'identifiants différents ont
   * fusionné — voir `push` ci-dessous.
   */
  product_id: string | null;
```

Dans `buildConsolidatedItems`, étendre la signature de `push` et son corps :

```ts
  const push = (
    entry: {
      name: string; quantity: number; unit?: string | null;
      rayon?: string | null; category?: string | null;
      ean13?: string | null; product_id?: string | null;
    },
    source: Source,
  ) => {
    const k = keyOf(entry.name, entry.unit ?? 'unité');
    const existant = bucket.get(k);
    if (existant) {
      existant.totalQuantity += entry.quantity;
      existant.sources.push(source);
      if (!existant.ean13 && entry.ean13) existant.ean13 = entry.ean13;
      // Deux origines d'identifiants différents : on efface plutôt que de
      // trancher au hasard. Une équivalence enregistrée sur le mauvais produit
      // se rejouerait à chaque commande.
      if (existant.product_id && entry.product_id
          && existant.product_id !== entry.product_id) {
        existant.product_id = null;
      }
    } else {
      bucket.set(k, {
        key: k,
        name: entry.name,
        unit: entry.unit ?? 'unité',
        rayon: rayonDepuisLibelle(entry.rayon ?? entry.category),
        totalQuantity: entry.quantity,
        ean13: entry.ean13 ?? null,
        product_id: entry.product_id ?? null,
        sources: [source],
      });
    }
  };
```

Transmettre l'identifiant depuis les trois origines. Pour les ingrédients :

```ts
      push(
        {
          name: ing.name, quantity: qty, unit: ing.unit,
          rayon: ing.rayon, category: ing.category,
          product_id: ing.product_id ?? null,
        },
        { type: 'recipe', label: recipe.name, qty },
      );
```

Pour le quotidien :

```ts
      {
        name: p.name,
        quantity: qty,
        unit: p.unit ?? 'unité',
        category: p.category,
        ean13: p.ean13,
        product_id: p.id,
      },
```

Les ajouts manuels n'en ont pas : `push(e, …)` passe un objet sans
`product_id`, qui vaut donc `null`.

Étendre enfin `ItemPanier` et `construireItems` :

```ts
export type ItemPanier = {
  name: string;
  quantity: number;
  unit: string;
  ean13: string | null;
  category: CleRayon;
  /** Nécessaire pour enregistrer une équivalence ; `null` si l'origine est incertaine. */
  product_id: string | null;
};
```

```ts
export function construireItems(lignes: LigneConsolidee[]): ItemPanier[] {
  return lignes.map((l) => ({
    name: l.name,
    quantity: l.totalQuantity,
    unit: l.unit,
    ean13: l.ean13 ?? null,
    category: l.rayon,
    product_id: l.product_id ?? null,
  }));
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
git add mobile/lib/consolidation.ts mobile/lib/consolidation.test.mjs
git commit -m "feat: la liste envoyée porte l'identifiant du produit"
```

---

## Phase 2 — Le client Supabase de l'extension

### Tâche 3 : session et appels REST

**Fichiers :**
- Créer : `extension/lib/session.js` (pur)
- Créer : `extension/lib/equivalences.js` (pur)
- Créer : `extension/supabase.js` (réseau et stockage)
- Test : `extension/lib.test.mjs`

**Interfaces :**
- Produit, dans `lib/session.js` :
  - `estExpire(session, maintenantMs): boolean` — vrai si absent ou expirant dans moins de 60 s
  - `entetes(session, cleApi): Record<string, string>`
- Produit, dans `lib/equivalences.js` :
  - `strategie(equivalence): { voie: 'url'|'label'|'absent'|'recherche', valeur: string|null }`
  - `indexer(lignes): Map<string, object>` — clé `product_id`
- Produit, dans `supabase.js` :
  - `connexion(email, motDePasse)`, `deconnexion()`, `sessionCourante()`
  - `travauxEnAttente()`, `revendiquer(id)`, `progresser(id, avancement)`, `terminer(id, statut, resultats, erreur)`
  - `equivalencesDe(drive)`, `enregistrerEquivalence(entree)`

- [ ] **Étape 1 : écrire les tests qui échouent**

Créer `extension/lib.test.mjs` :

```js
/**
 * Logique pure du pont Supabase : expiration de session et choix de la voie
 * d'accès à un produit. Aucun appel réseau ici.
 * Lancer : node --test extension/lib.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estExpire, entetes } from './lib/session.js';
import { strategie, indexer } from './lib/equivalences.js';

const MAINTENANT = 1_700_000_000_000;

test('une session absente est considérée expirée', () => {
  assert.equal(estExpire(null, MAINTENANT), true);
  assert.equal(estExpire({}, MAINTENANT), true);
});

test('une session encore valable une heure ne l\'est pas', () => {
  assert.equal(estExpire({ expire_le: MAINTENANT + 3_600_000 }, MAINTENANT), false);
});

test('une session qui expire dans moins d\'une minute est renouvelée d\'avance', () => {
  // Rafraîchir au dernier moment ferait échouer la requête en vol : le jeton
  // peut expirer entre la vérification et l'arrivée au serveur.
  assert.equal(estExpire({ expire_le: MAINTENANT + 30_000 }, MAINTENANT), true);
  assert.equal(estExpire({ expire_le: MAINTENANT - 1 }, MAINTENANT), true);
});

test('les en-têtes portent la clé publiable et le jeton', () => {
  const h = entetes({ jeton: 'abc' }, 'cle-publique');
  assert.equal(h.apikey, 'cle-publique');
  assert.equal(h.Authorization, 'Bearer abc');
  assert.equal(h['Content-Type'], 'application/json');
});

test('une adresse de fiche mémorisée court-circuite la recherche', () => {
  const s = strategie({ product_url: 'https://x/p/1', matched_label: 'Lardons', unavailable: false });
  assert.deepEqual(s, { voie: 'url', valeur: 'https://x/p/1' });
});

test('à défaut d\'adresse, le libellé exact est retenu', () => {
  // C'est la seule voie chez Leclerc, dont les liens produit n'ont pas
  // d'adresse lisible.
  const s = strategie({ product_url: null, matched_label: 'Lardons fumés BIO', unavailable: false });
  assert.deepEqual(s, { voie: 'label', valeur: 'Lardons fumés BIO' });
});

test('un produit marqué indisponible est écarté, pas cherché', () => {
  const s = strategie({ product_url: 'https://x', matched_label: 'X', unavailable: true });
  assert.equal(s.voie, 'absent');
});

test('sans équivalence mémorisée, on retombe sur la recherche', () => {
  assert.deepEqual(strategie(null), { voie: 'recherche', valeur: null });
  assert.deepEqual(strategie({ product_url: null, matched_label: null, unavailable: false }),
    { voie: 'recherche', valeur: null });
});

test('les équivalences sont indexées par produit', () => {
  const m = indexer([
    { product_id: 'p1', matched_label: 'A' },
    { product_id: 'p2', matched_label: 'B' },
  ]);
  assert.equal(m.get('p1').matched_label, 'A');
  assert.equal(m.size, 2);
});

test('indexer tolère une liste vide ou absente', () => {
  assert.equal(indexer([]).size, 0);
  assert.equal(indexer(null).size, 0);
});
```

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

Depuis `extension/` :

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib.test.mjs
```

Attendu : ÉCHEC, `ERR_MODULE_NOT_FOUND` sur `./lib/session.js`.

- [ ] **Étape 3 : écrire les deux modules purs**

Créer `extension/lib/session.js` :

```js
/**
 * Logique de session, sans accès au réseau ni au stockage.
 *
 * Séparée de `supabase.js` pour rester exécutable sous `node --test` : un
 * module qui importe `chrome.*` ne l'est pas.
 */

/** Marge avant expiration : on renouvelle d'avance, jamais au dernier moment. */
const MARGE_MS = 60_000;

/**
 * Dit si une session doit être renouvelée avant d'être utilisée.
 *
 * La marge évite qu'un jeton expire entre la vérification et l'arrivée de la
 * requête au serveur — la panne serait alors intermittente et incompréhensible.
 */
export function estExpire(session, maintenantMs) {
  if (!session?.expire_le) return true;
  return session.expire_le - MARGE_MS <= maintenantMs;
}

/** En-têtes d'un appel authentifié à Supabase. */
export function entetes(session, cleApi) {
  return {
    apikey: cleApi,
    Authorization: `Bearer ${session?.jeton ?? ''}`,
    'Content-Type': 'application/json',
  };
}
```

Créer `extension/lib/equivalences.js` :

```js
/**
 * Choix de la voie d'accès à un produit chez une enseigne, d'après ce qui a
 * été mémorisé lors des commandes précédentes.
 *
 * C'est ce qui rend les commandes suivantes déterministes : une ambiguïté
 * tranchée une fois ne se repose plus.
 */

/**
 * @param {object|null} equivalence Ligne de `product_equivalents`, ou null.
 * @returns {{voie: 'url'|'label'|'absent'|'recherche', valeur: string|null}}
 */
export function strategie(equivalence) {
  if (!equivalence) return { voie: 'recherche', valeur: null };
  // L'indisponibilité prime : inutile de chercher ce qu'on sait absent.
  if (equivalence.unavailable) return { voie: 'absent', valeur: null };
  if (equivalence.product_url) return { voie: 'url', valeur: equivalence.product_url };
  // Seule voie chez Leclerc, dont les liens produit n'ont pas d'adresse.
  if (equivalence.matched_label) return { voie: 'label', valeur: equivalence.matched_label };
  return { voie: 'recherche', valeur: null };
}

/** Indexe les équivalences par identifiant de produit. */
export function indexer(lignes) {
  const m = new Map();
  for (const l of lignes ?? []) {
    if (l?.product_id) m.set(l.product_id, l);
  }
  return m;
}
```

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib.test.mjs
```

Attendu : `# pass 10`, `# fail 0`.

- [ ] **Étape 5 : écrire le client réseau**

Créer `extension/supabase.js`. Il importe les deux modules purs et n'ajoute que
les appels.

```js
/**
 * Client Supabase de l'extension, en appels REST directs.
 *
 * Pas de `@supabase/supabase-js` : l'extension n'a aucune chaîne de
 * compilation et s'installe en dossier non empaqueté. Y ajouter un paquet npm
 * imposerait un bundler et changerait la façon de l'installer.
 *
 * La clé publiable est publique par conception — RLS assure l'isolation des
 * données. Le jeton de session, lui, vit dans `chrome.storage.local`.
 */
import { estExpire, entetes } from './lib/session.js';

const URL_SB = 'https://qmymwicsgilhoihtfdjm.supabase.co';
const CLE = 'sb_publishable_PueJWmalqhZO0ctPu95GKQ_EaAgVulr';
const CLE_SESSION = 'courses_session';

async function lireSession() {
  const s = await chrome.storage.local.get(CLE_SESSION);
  return s[CLE_SESSION] ?? null;
}

async function ecrireSession(session) {
  await chrome.storage.local.set({ [CLE_SESSION]: session });
}

/** Convertit une réponse de jeton Supabase en session stockable. */
function versSession(data) {
  return {
    jeton: data.access_token,
    rafraichissement: data.refresh_token,
    expire_le: Date.now() + (data.expires_in ?? 3600) * 1000,
    email: data.user?.email ?? null,
  };
}

export async function connexion(email, motDePasse) {
  const r = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: CLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: motDePasse }),
  });
  if (!r.ok) {
    // Message français, jamais la réponse brute de Supabase.
    return { ok: false, erreur: 'E-mail ou mot de passe incorrect.' };
  }
  await ecrireSession(versSession(await r.json()));
  return { ok: true };
}

export async function deconnexion() {
  await chrome.storage.local.remove(CLE_SESSION);
}

export async function sessionCourante() {
  return lireSession();
}

/** Renvoie une session valide, en la renouvelant si besoin. */
async function sessionValide() {
  const session = await lireSession();
  if (!estExpire(session, Date.now())) return session;
  if (!session?.rafraichissement) return null;

  const r = await fetch(`${URL_SB}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: CLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.rafraichissement }),
  });
  if (!r.ok) {
    // Le jeton de rafraîchissement est mort : on efface plutôt que de
    // réessayer indéfiniment avec une session qui ne reviendra pas.
    await deconnexion();
    return null;
  }
  const suite = versSession(await r.json());
  await ecrireSession(suite);
  return suite;
}

async function appel(chemin, options = {}) {
  const session = await sessionValide();
  if (!session) return { ok: false, deconnecte: true };
  const r = await fetch(`${URL_SB}/rest/v1/${chemin}`, {
    ...options,
    headers: { ...entetes(session, CLE), ...(options.headers ?? {}) },
  });
  if (!r.ok) {
    console.error('[supabase]', chemin, r.status, await r.text());
    return { ok: false, statut: r.status };
  }
  const texte = await r.text();
  return { ok: true, data: texte ? JSON.parse(texte) : null };
}

/** Travaux en attente, du plus ancien au plus récent. */
export async function travauxEnAttente() {
  return appel('cart_jobs?status=eq.pending&select=*&order=created_at.asc');
}

/**
 * Travaux revendiqués mais abandonnés depuis plus de trente minutes.
 *
 * Sans cette reprise, une extension fermée en plein remplissage laisserait la
 * liste bloquée pour toujours, sans qu'aucun écran n'explique pourquoi.
 */
export async function travauxAbandonnes() {
  const limite = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  return appel(
    `cart_jobs?status=in.(claimed,running)&claimed_at=lt.${limite}&select=*&order=created_at.asc`,
  );
}

export async function revendiquer(id) {
  return appel(`cart_jobs?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'claimed', claimed_at: new Date().toISOString() }),
  });
}

export async function progresser(id, avancement) {
  return appel(`cart_jobs?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'running', progress: avancement }),
  });
}

export async function terminer(id, statut, resultats, erreur = null) {
  return appel(`cart_jobs?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: statut,
      results: resultats,
      error: erreur,
      finished_at: new Date().toISOString(),
    }),
  });
}

export async function equivalencesDe(drive) {
  return appel(`product_equivalents?drive=eq.${encodeURIComponent(drive)}&select=*`);
}

/**
 * Enregistre ou met à jour une équivalence.
 *
 * `resolution=merge-duplicates` s'appuie sur la contrainte unique
 * (user_id, product_id, drive) : une seconde résolution de la même ambiguïté
 * remplace la précédente au lieu d'échouer.
 */
export async function enregistrerEquivalence(entree) {
  return appel('product_equivalents', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ ...entree, last_confirmed_at: new Date().toISOString() }),
  });
}
```

- [ ] **Étape 6 : déclarer le domaine dans le manifeste**

Dans `extension/manifest.json`, ajouter à `host_permissions` :

```json
    "https://qmymwicsgilhoihtfdjm.supabase.co/*"
```

et à `permissions` :

```json
    "alarms"
```

- [ ] **Étape 7 : commit**

```bash
git add extension/lib extension/supabase.js extension/lib.test.mjs extension/manifest.json
git commit -m "feat: client Supabase de l'extension, en REST sans bundler"
```

---

### Tâche 4 : se connecter depuis le popup

**Fichiers :**
- Modifier : `extension/popup.html`
- Modifier : `extension/popup.js`
- Modifier : `extension/popup.css`

**Interfaces :**
- Consomme : `connexion`, `deconnexion`, `sessionCourante` de `supabase.js`.

- [ ] **Étape 1 : ajouter le bloc de connexion**

Dans `extension/popup.html`, avant le panneau existant, un bloc `#compte`
portant : un champ e-mail, un champ mot de passe, un bouton **Se connecter**,
une zone de message, et — une fois connecté — l'adresse affichée avec un lien
**Se déconnecter**.

- [ ] **Étape 2 : câbler le popup**

Dans `extension/popup.js`, importer les trois fonctions et, au chargement,
appeler `sessionCourante()` :

- **session absente** → le bloc de connexion est visible, la liste des travaux
  masquée ; la saisie manuelle **reste accessible**, elle ne dépend pas de
  Supabase ;
- **session présente** → l'adresse s'affiche, le bloc de connexion est masqué.

À la soumission, appeler `connexion(email, motDePasse)`. En cas d'échec,
afficher `res.erreur` — une phrase française, jamais la réponse brute.

Le bouton est désactivé pendant l'appel.

- [ ] **Étape 3 : styles**

Dans `extension/popup.css`, reprendre les classes existantes — `.field`,
`.btn`, `.hint` — sans en inventer de nouvelles au-delà de ce que le bloc exige.

- [ ] **Étape 4 : vérifier à la main**

Recharger l'extension dans `chrome://extensions`, ouvrir le popup :

1. Sans session, le bloc de connexion s'affiche et la saisie manuelle reste
   utilisable.
2. Un mot de passe erroné affiche « E-mail ou mot de passe incorrect. ».
3. Une connexion réussie affiche l'adresse et masque le bloc.
4. Fermer et rouvrir le popup : la session persiste.

- [ ] **Étape 5 : commit**

```bash
git add extension/popup.html extension/popup.js extension/popup.css
git commit -m "feat: connexion Supabase depuis le popup de l'extension"
```

---

## Phase 3 — Le pont

### Tâche 5 : réveil, pastille, reprise du travail le plus ancien

**Fichiers :**
- Modifier : `extension/background.js`

**Interfaces :**
- Consomme : `travauxEnAttente`, `travauxAbandonnes`, `revendiquer` de `supabase.js`.
- Produit : message `travaux` renvoyant `{ enAttente: [...], total: number }` au popup.

- [ ] **Étape 1 : l'alarme et la pastille**

Ajouter en tête de `background.js` :

```js
import { travauxEnAttente, travauxAbandonnes, revendiquer } from './supabase.js';

/** Période de sondage. Un service worker MV3 ne survit pas à un abonnement. */
const PERIODE_MINUTES = 1;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('travaux', { periodInMinutes: PERIODE_MINUTES });
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('travaux', { periodInMinutes: PERIODE_MINUTES });
});

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'travaux') rafraichirPastille();
});

/**
 * Allume la pastille quand une liste attend. Ne démarre jamais rien : une
 * extension qui piloterait un site marchand sans qu'on l'ait déclenchée serait
 * une mauvaise surprise.
 */
async function rafraichirPastille() {
  const r = await travauxEnAttente();
  if (!r.ok) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  const premier = r.data?.[0];
  const n = premier ? (premier.items?.length ?? 0) : 0;
  await chrome.action.setBadgeText({ text: n > 0 ? String(n) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#2D6A4F' });
}
```

- [ ] **Étape 2 : exposer les travaux au popup**

Ajouter un gestionnaire de message, à côté des existants :

```js
  async travaux() {
    const attente = await travauxEnAttente();
    if (!attente.ok) return { ok: false, deconnecte: attente.deconnecte === true };
    const abandonnes = await travauxAbandonnes();
    // Un travail revendiqué puis abandonné redevient disponible : sinon une
    // extension fermée en plein remplissage bloquerait la liste pour toujours.
    const liste = [...(attente.data ?? []), ...(abandonnes.ok ? abandonnes.data ?? [] : [])];
    return { ok: true, data: { enAttente: liste, total: liste.length } };
  },
```

- [ ] **Étape 3 : afficher la liste dans le popup**

Dans `popup.js`, appeler `send({ type: 'travaux' })` au chargement quand une
session existe, et afficher pour le premier travail : le nombre d'articles, les
enseignes visées, et un bouton **Remplir le panier**.

Si `deconnecte` est vrai, afficher « Session expirée, reconnecte-toi » et
montrer le bloc de connexion.

- [ ] **Étape 4 : vérifier à la main**

Envoyer une liste depuis le téléphone, puis attendre une minute :

1. La pastille affiche le nombre d'articles.
2. Le popup montre le travail et ses enseignes.
3. Rien ne démarre tant qu'on ne clique pas.

- [ ] **Étape 5 : commit**

```bash
git add extension/background.js extension/popup.js
git commit -m "feat: l'extension relève les listes en attente et l'annonce par sa pastille"
```

---

### Tâche 6 : enchaîner les deux drives et rendre compte

**Fichiers :**
- Modifier : `extension/background.js`

**Interfaces :**
- Consomme : `progresser`, `terminer` de `supabase.js`.
- Produit : l'état interne gagne `jobId`, `drivesRestants`, `resultatsParDrive`.

- [ ] **Étape 1 : démarrer depuis un travail**

Ajouter un gestionnaire `demarrerTravail({ jobId })` qui :

1. revendique le travail (`revendiquer`) ;
2. convertit `items` au format attendu par l'orchestrateur — `ean13` devient
   `ean`, le reste est repris tel quel ;
3. pose l'état avec `site` = première enseigne de `drives`,
   `drivesRestants` = le reste, `jobId`, `resultatsParDrive` = `{}` ;
4. lance `processJob()`.

- [ ] **Étape 2 : écrire la progression**

Dans la boucle de `processJob`, après `await setState({ results, cursor: index + 1 })`,
ajouter :

```js
    if (state.jobId) {
      // Le compte porte sur l'enseigne en cours, pas sur le total des deux :
      // une progression cumulée serait trompeuse une fois la première finie.
      await progresser(state.jobId, {
        drive: state.site,
        fait: index + 1,
        total: state.items.length,
      });
    }
```

- [ ] **Étape 3 : passer à l'enseigne suivante**

Remplacer la branche de fin de liste — celle qui pose `status: 'done'` — par :

```js
    if (index >= state.items.length) {
      const parDrive = { ...(state.resultatsParDrive ?? {}), [state.site]: state.results };
      const restants = state.drivesRestants ?? [];

      if (restants.length > 0) {
        const suivant = restants[0];
        const cfgSuivant = SITES[suivant];
        // On repart de l'origine de l'enseigne suivante — `origin` existe déjà
        // dans sites.js. Si la session n'y est pas ouverte ou le magasin pas
        // choisi, l'agent le signalera au premier produit et on s'arrêtera
        // proprement.
        await chrome.tabs.update(tabId, { url: cfgSuivant.origin });
        await waitForTab(tabId);
        await setState({
          site: suivant,
          drivesRestants: restants.slice(1),
          resultatsParDrive: parDrive,
          results: [],
          cursor: 0,
        });
        continue;
      }

      await setState({ status: 'done', finishedAt: Date.now(), resultatsParDrive: parDrive });
      if (state.jobId) await terminer(state.jobId, 'done', parDrive);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-128.png',
        title: 'Panier rempli',
        message: `${state.results.filter((r) => r.ok).length} produit(s) ajouté(s) sur ${cfg.label}.`,
      });
      return;
    }
```

**Note :** `content/sites.js` expose déjà `origin` pour les deux enseignes —
`https://www.carrefour.fr` et `https://www.leclercdrive.fr`. Rien à ajouter.
`baseOrigin`, relevé sur l'onglet courant, reste préféré une fois sur place :
chez Leclerc l'adresse dépend du magasin choisi.

- [ ] **Étape 4 : marquer `needs_action` sur un blocage**

Remplacer la branche du challenge par :

```js
    if (!result.ok && result.reason === 'challenge') {
      await setState({ status: 'paused', pauseReason: 'challenge' });
      if (state.jobId) {
        // `needs_action` et non `failed` : rien n'est cassé, il manque un geste
        // humain. Le téléphone peut le dire en clair.
        await terminer(
          state.jobId, 'needs_action',
          { ...(state.resultatsParDrive ?? {}), [state.site]: state.results },
          `Vérification demandée sur ${cfg.label}.`,
        );
      }
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-128.png',
        title: 'Vérification demandée',
        message: 'Le site demande une vérification. Résous-la dans l\'onglet, puis reprends.',
      });
      return;
    }
```

- [ ] **Étape 5 : vérifier à la main**

Avec une liste visant les deux enseignes, connecté aux deux :

1. Le premier drive se remplit, la progression s'écrit — vérifier en base :
   `select status, progress from public.cart_jobs order by created_at desc limit 1;`
2. L'onglet bascule sur le second et poursuit.
3. À la fin, `status` vaut `done` et `results` porte les deux enseignes.
4. En se déconnectant du second drive avant l'essai, `status` doit valoir
   `needs_action` et `results` contenir le travail du premier.

- [ ] **Étape 6 : commit**

```bash
git add extension/background.js extension/content/sites.js
git commit -m "feat: les deux enseignes s'enchaînent, et un blocage devient needs_action"
```

---

### Tâche 7 : les équivalences

**Fichiers :**
- Modifier : `extension/background.js`

**Interfaces :**
- Consomme : `equivalencesDe`, `enregistrerEquivalence` de `supabase.js` ;
  `strategie`, `indexer` de `lib/equivalences.js`.

- [ ] **Étape 1 : extraire la construction de l'URL de recherche**

`attempt` construit son URL en ligne, aux lignes 140-142 de `background.js`.
La branche « libellé mémorisé » en a besoin aussi. Extraire, plutôt que de la
dupliquer :

```js
/** URL de la page de résultats pour un produit, chez une enseigne. */
function urlDeRecherche(cfg, item, baseOrigin) {
  return cfg.searchPath && baseOrigin
    ? baseOrigin + cfg.searchPath.replace('{q}', encodeURIComponent(item.name))
    : null;
}
```

et remplacer l'expression d'origine dans `attempt` par un appel.

- [ ] **Étape 2 : consulter avant de chercher**

Au démarrage d'une enseigne, charger ses équivalences et les indexer :

```js
  const eq = await equivalencesDe(site);
  const index = indexer(eq.ok ? eq.data : []);
```

Stocker l'index dans l'état sous forme d'objet simple —
`Object.fromEntries(index)` — `chrome.storage` ne sait pas sérialiser une `Map`.

Dans `attempt`, avant toute recherche :

```js
  const memorise = item.product_id ? equivalences[item.product_id] : null;
  const voie = strategie(memorise);

  if (voie.voie === 'absent') {
    return { ok: false, reason: 'product_unavailable', memorise: true };
  }
  if (voie.voie === 'url') {
    // Adresse mémorisée : aucune recherche, aucun libellé à interpréter.
    await chrome.tabs.update(tabId, { url: voie.valeur });
    await waitForTab(tabId);
    return { ...(await runAgent(tabId, cfg, item, 'run')), via: 'equivalence_url' };
  }
  if (voie.voie === 'label') {
    // Chez Leclerc, les liens produit n'ont pas d'adresse : le libellé exact
    // est la seule voie déterministe.
    const searchUrl = urlDeRecherche(cfg, item, baseOrigin);
    await chrome.tabs.update(tabId, { url: searchUrl });
    await waitForTab(tabId);
    const r = await runAgent(tabId, cfg, { ...item, exactLabel: voie.valeur }, 'run');
    return { ...r, searchUrl, via: 'equivalence_label' };
  }
```

- [ ] **Étape 3 : enregistrer après un choix humain**

Dans `chooseCandidate`, après un ajout réussi :

```js
  const item = state.items?.[index];
  if (result.ok && state.jobId && item?.product_id) {
    // Une ambiguïté tranchée une fois ne se repose plus : c'est tout l'intérêt.
    await enregistrerEquivalence({
      product_id: item.product_id,
      drive: state.site,
      search_query: item.name,
      matched_label: label,
      // Surtout pas `result.url` : après une recherche, l'agent rend l'adresse
      // de la page de RÉSULTATS, pas celle de la fiche. L'enregistrer comme
      // fiche ferait revenir l'extension sur une page de recherche à chaque
      // commande, en croyant aller droit au produit. Le libellé exact suffit,
      // et c'est de toute façon la seule voie chez Leclerc.
      product_url: null,
      ean13: item.ean ?? null,
      unavailable: false,
    });
  }
```

- [ ] **Étape 4 : enregistrer une absence**

Dans la boucle, après un échec dont la raison est `no_match` ou
`product_unavailable`, et si l'échec n'est pas déjà mémorisé :

```js
    if (!result.ok && !result.memorise && state.jobId && item.product_id
        && ['no_match', 'product_unavailable'].includes(result.reason)) {
      // Enregistrer l'absence évite de la redécouvrir à chaque commande, et
      // alimentera le comparatif « produits manquants ».
      await enregistrerEquivalence({
        product_id: item.product_id,
        drive: state.site,
        search_query: item.name,
        unavailable: true,
      });
    }
```

- [ ] **Étape 5 : vérifier à la main**

1. Lancer une liste, résoudre une ambiguïté par **Choisir**.
2. Vérifier en base :
   `select drive, search_query, matched_label, unavailable from public.product_equivalents;`
3. Relancer la même liste : la ligne doit passer sans ambiguïté, et le journal
   du popup l'indiquer.

- [ ] **Étape 6 : commit**

```bash
git add extension/background.js
git commit -m "feat: une ambiguïté tranchée une fois ne se repose plus"
```

---

## Phase 4 — Le suivi sur le téléphone

### Tâche 8 : l'écran de suivi

**Fichiers :**
- Créer : `mobile/stores/suivi.ts`
- Modifier : `mobile/components/wizard/EtapeGeneration.tsx`
- Test : `mobile/lib/suivi-libelles.test.mjs`
- Créer : `mobile/lib/suivi-libelles.ts`

**Interfaces :**
- Produit :
  - `useSuiviTravail(jobId: string | null): { travail: Travail | null; chargement: boolean }`
  - `type Travail = { id: string; status: string; progress: { drive?: string; fait?: number; total?: number }; results: Record<string, Array<{ item: string; ok: boolean; message?: string }>> | null; error: string | null }`
  - `libelleEtat(statut: string): string`
  - `resume(travail: Travail): string`

- [ ] **Étape 1 : écrire les tests qui échouent**

Créer `mobile/lib/suivi-libelles.test.mjs` :

```js
/**
 * Textes de l'écran de suivi. Fonctions pures, sans réseau.
 * Lancer : node --test mobile/lib/suivi-libelles.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { libelleEtat, resume } from './suivi-libelles.ts';

test('chaque état a une phrase française, jamais son code', () => {
  for (const s of ['pending', 'claimed', 'running', 'needs_action', 'done', 'failed', 'cancelled']) {
    const t = libelleEtat(s);
    assert.ok(t.length > 0, `état sans libellé : ${s}`);
    assert.ok(!t.includes(s), `le code technique fuit dans le libellé : ${t}`);
  }
});

test('un état inconnu ne casse pas l\'écran', () => {
  assert.ok(libelleEtat('quelque_chose').length > 0);
});

test('le résumé en cours indique l\'enseigne et l\'avancement', () => {
  const t = resume({ status: 'running', progress: { drive: 'carrefour', fait: 12, total: 34 } });
  assert.match(t, /12/);
  assert.match(t, /34/);
  assert.match(t, /Carrefour/);
});

test('le résumé en attente ne prétend pas que ça avance', () => {
  const t = resume({ status: 'pending', progress: {} });
  assert.ok(!/\d+ sur \d+/.test(t), `progression inventée : ${t}`);
});

test('un travail à reprendre le dit clairement', () => {
  const t = resume({ status: 'needs_action', progress: {}, error: 'Vérification demandée sur Carrefour.' });
  assert.match(t, /Carrefour/);
});
```

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/suivi-libelles.test.mjs
```

Attendu : ÉCHEC, `ERR_MODULE_NOT_FOUND`.

- [ ] **Étape 3 : écrire les libellés**

Créer `mobile/lib/suivi-libelles.ts` :

```ts
/** Textes de l'écran de suivi. Aucun code technique ne doit atteindre l'écran. */

const ETATS: Record<string, string> = {
  pending: 'En attente de ton Mac',
  claimed: 'Prise en charge',
  running: 'Remplissage en cours',
  needs_action: 'Ton intervention est nécessaire',
  done: 'Panier rempli',
  failed: 'Le remplissage a échoué',
  cancelled: 'Annulé',
};

const DRIVES: Record<string, string> = {
  carrefour: 'Carrefour',
  leclerc: 'E.Leclerc',
};

export function libelleEtat(statut: string): string {
  return ETATS[statut] ?? 'État inconnu';
}

export function libelleDrive(cle: string | undefined): string {
  return DRIVES[cle ?? ''] ?? (cle ?? '');
}

export function resume(travail: {
  status: string;
  progress?: { drive?: string; fait?: number; total?: number } | null;
  error?: string | null;
}): string {
  const p = travail.progress ?? {};
  if (travail.status === 'running' && p.fait != null && p.total != null) {
    return `${p.fait} sur ${p.total} chez ${libelleDrive(p.drive)}`;
  }
  if (travail.status === 'needs_action') {
    return travail.error ?? 'Ouvre l\'extension sur ton Mac pour reprendre.';
  }
  if (travail.status === 'pending') {
    return 'Ouvre l\'extension sur ton Mac : elle attend ton feu vert.';
  }
  if (travail.status === 'failed') return travail.error ?? 'Réessaie depuis l\'extension.';
  return libelleEtat(travail.status);
}
```

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
```

Attendu : `# fail 0`.

- [ ] **Étape 5 : l'abonnement temps réel**

Créer `mobile/stores/suivi.ts` :

```ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type Travail = {
  id: string;
  status: string;
  progress: { drive?: string; fait?: number; total?: number } | null;
  results: Record<string, Array<{ item: string; ok: boolean; message?: string }>> | null;
  error: string | null;
};

/**
 * Suit un travail de remplissage en temps réel.
 *
 * `cart_jobs` est déjà publiée dans `supabase_realtime` — vérifié le 22/08.
 * Une première lecture précède l'abonnement : sans elle, l'écran resterait
 * vide jusqu'au premier changement, qui peut ne jamais venir si le Mac a fini
 * avant qu'on regarde.
 */
export function useSuiviTravail(jobId: string | null) {
  const [travail, setTravail] = useState<Travail | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!jobId) {
      setChargement(false);
      return;
    }
    let vivant = true;

    (async () => {
      const { data } = await supabase
        .from('cart_jobs')
        .select('id, status, progress, results, error')
        .eq('id', jobId)
        .maybeSingle();
      if (vivant) {
        setTravail((data as Travail) ?? null);
        setChargement(false);
      }
    })();

    const canal = supabase
      .channel(`travail-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cart_jobs', filter: `id=eq.${jobId}` },
        (message) => { if (vivant) setTravail(message.new as Travail); },
      )
      .subscribe();

    return () => {
      vivant = false;
      supabase.removeChannel(canal);
    };
  }, [jobId]);

  return { travail, chargement };
}
```

- [ ] **Étape 6 : transformer l'écran de confirmation en écran de suivi**

Dans `mobile/components/wizard/EtapeGeneration.tsx` :

`envoyerListe` renvoie aujourd'hui `{ ok }`. L'étendre pour renvoyer
l'identifiant créé — ajouter `.select('id').single()` à l'insertion dans
`mobile/lib/cart-jobs.ts` et renvoyer `{ ok: true, id }`.

Conserver cet identifiant dans un état, et remplacer l'écran de confirmation
figé par le suivi : `libelleEtat(travail.status)` en titre, `resume(travail)` en
dessous, et à la fin la liste de ce qui n'a pas été trouvé, tirée de `results`.

Le bouton **Terminer** reste, et réinitialise le wizard.

- [ ] **Étape 7 : vérifier**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
```

Attendu : aucune erreur, `# fail 0`.

- [ ] **Étape 8 : commit**

```bash
git add mobile/lib/suivi-libelles.ts mobile/lib/suivi-libelles.test.mjs mobile/stores/suivi.ts mobile/lib/cart-jobs.ts mobile/components/wizard/EtapeGeneration.tsx
git commit -m "feat: écran de suivi du remplissage en temps réel"
```

---

## Phase 5 — Livraison

### Tâche 9 : livrer et éprouver la boucle

- [ ] **Étape 1 : vérification complète**

Depuis `mobile/` :

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
npx expo-doctor
```

Depuis `extension/` :

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test *.test.mjs
```

Attendu : aucune erreur TypeScript, `# fail 0` des deux côtés, expo-doctor sans
échec autre que les deux connus — CocoaPods local et l'avertissement CNG.

- [ ] **Étape 2 : vérifier le bundle, comme la CI**

```bash
EXPO_PUBLIC_SUPABASE_URL="https://qmymwicsgilhoihtfdjm.supabase.co" \
EXPO_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_PueJWmalqhZO0ctPu95GKQ_EaAgVulr" \
npx expo export --platform ios --output-dir /tmp/export-lot5
```

Attendu : `Exported:` sans erreur.

- [ ] **Étape 3 : ne pas toucher au numéro de build**

Xcode Cloud impose le sien, repris du numéro d'exécution. Ni `app.json` ni
`Info.plist` ne sont à modifier.

- [ ] **Étape 4 : pousser**

```bash
git push origin mobile/expo-scan
```

- [ ] **Étape 5 : suivre le build par l'API**

Depuis le répertoire de travail de la session, avec `asc.mjs`. **Trier
explicitement** : l'API ne rend pas les exécutions de la plus récente à la plus
ancienne, et `limit=1` renvoie la première, pas la dernière — piège rencontré le
22/08, qui a fait surveiller le build n°1 pendant quarante minutes.

```bash
ASC_KEY_ID=AYC86383MB \
ASC_ISSUER_ID=a725aaeb-78b3-44bb-80ee-018ca724ba5f \
ASC_KEY_PATH="$HOME/.appstoreconnect/AuthKey_AYC86383MB.p8" \
node asc.mjs "/v1/ciProducts/4ece9928-69b5-4a0a-a0cc-bdd408d09a57/buildRuns?limit=10"
```

- [ ] **Étape 6 : éprouver la boucle complète**

1. Recharger l'extension dans `chrome://extensions`, s'y connecter.
2. Sur le téléphone, composer une liste visant les deux enseignes et l'envoyer.
3. L'écran de suivi affiche « En attente de ton Mac ».
4. Au bout d'une minute, la pastille s'allume sur l'extension.
5. Cliquer **Remplir le panier** : l'écran du téléphone passe à
   « Remplissage en cours » et compte les articles.
6. Vérifier que l'immuabilité de `items` tient — le contrôle reporté de la
   tâche 1 :
   `update public.cart_jobs set items = '[]'::jsonb where id = '<id du travail>';`
   Attendu : `ERROR: items est immuable une fois le travail créé`.
7. Résoudre une ambiguïté par **Choisir**, puis vérifier l'équivalence :
   `select drive, search_query, matched_label from public.product_equivalents;`
8. Relancer la même liste : la ligne doit passer sans ambiguïté.

## Ce que ce plan ne fait pas

- Le lot 6 : retrait de FastAPI et du front web.
- L'import de recettes par lien ou par OCR.
- Le partage du foyer.
- La reprise automatique d'un travail `needs_action` : c'est un clic humain qui
  la déclenche, comme le premier départ.
