# Application mobile Expo — lots 1 à 3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Amener courses-app sur iPhone via Expo Go, avec le catalogue produits servi par Supabase et le scan de codes-barres alimentant les favoris depuis Open Food Facts.

**Architecture :** Les données quittent SQLite pour Postgres (Supabase), protégées par RLS. Une application Expo (expo-router) les lit directement via `supabase-js`, sans backend intermédiaire. Le scan lit un EAN13 avec `expo-camera`, interroge Open Food Facts et crée un produit dans le catalogue.

**Tech Stack :** Expo SDK 57 · expo-router · TypeScript · @supabase/supabase-js · expo-camera · expo-haptics · Postgres 17 (Supabase) · `node --test` pour les fonctions pures.

## Global Constraints

- **Projet Supabase :** `qmymwicsgilhoihtfdjm` (région eu-west-3). URL : `https://qmymwicsgilhoihtfdjm.supabase.co`. Clé publiable : `sb_publishable_PueJWmalqhZO0ctPu95GKQ_EaAgVulr`.
- **Zéro emoji dans l'interface.** Contrainte non négociable du `CLAUDE.md`.
- **Thème clair premium** — fond crème `#FAFAF8`, surface `#FFFFFF`, accent `#2D6A4F`, texte `#1C1C1A`, texte atténué `#6B6B6B`, bordure `#E6E4DF`. Reprend les variables du front web.
- **Typographie :** system-ui / San Francisco. Hiérarchie claire.
- **Tout état visible :** chargement, vide, erreur, confirmation. Jamais d'écran muet.
- **Français** pour l'interface, les commentaires et les messages de commit.
- **Nommage :** camelCase TypeScript, PascalCase composants, snake_case colonnes SQL.
- **Aucun identifiant de drive n'est stocké**, dans aucune table, à aucun moment.
- **RLS obligatoire** sur chaque table créée, avec la clause `(select auth.uid()) = user_id`.
- Les migrations Supabase passent par l'outil `apply_migration`, jamais par `execute_sql`.
- **Les imports entre modules de `mobile/lib/` portent l'extension `.ts`**
  (`from './typology.ts'`). Sans elle, `node --test` échoue en
  `ERR_MODULE_NOT_FOUND`, et sans le drapeau ci-dessous il exécute **zéro test
  en annonçant un succès** — un faux vert. Mesuré sous Node 22.22.
- **Les tests des fonctions pures se lancent avec**
  `node --experimental-strip-types --test <fichier>`.

---

## Lot 1 — Schéma Supabase et migration des données

### Task 1: Schéma Postgres et politiques RLS

**Files:**
- Create: `supabase/migrations/0002_catalogue.sql` (trace locale ; l'application se fait via `apply_migration`)
- Test: vérifications SQL des étapes 3 et 4, puis test de cloisonnement réel en Task 5 étape 7

**Interfaces:**
- Consomme : la table `cart_jobs` et la fonction `public.set_updated_at()` existantes (migrations `create_cart_jobs_queue` et `harden_set_updated_at`).
- Produit : les tables `products`, `categories`, `category_aliases`, `recipes`, `recipe_ingredients`, `purchase_lines`, `product_equivalents`, toutes avec `user_id uuid` et RLS active.

- [ ] **Step 1: Écrire la migration**

Créer `supabase/migrations/0002_catalogue.sql` :

```sql
-- Catalogue produits, recettes et équivalences drive.
-- Chaque table est cloisonnée par utilisateur : la v1 est mono-utilisateur.
-- Le partage foyer se fera plus tard en remplaçant la clause unique de chaque
-- politique par un test d'appartenance à un household.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  label text not null,
  icon text not null default '',
  display_order integer not null default 0,
  unique (user_id, key)
);

create table public.category_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label_raw text not null,
  key_canonical text not null,
  unique (user_id, label_raw)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ean13 text,
  name text not null,
  brand text,
  category text,
  default_quantity integer not null default 1,
  unit text not null default 'piece',
  favorite boolean not null default false,
  notes text,
  price_ttc numeric(10, 2),
  image_url text,
  brand_type text not null default 'common',
  store_brand_affinity text,
  grammage_g integer,
  volume_ml integer,
  product_type text,
  -- Un même code-barres ne peut entrer deux fois dans le catalogue d'une
  -- personne : c'est ce qui permet au scan de détecter un doublon.
  unique (user_id, ean13)
);
create index products_user_name_idx on public.products (user_id, name);
create index products_user_favorite_idx on public.products (user_id, favorite) where favorite;

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  description text,
  servings_default integer not null default 4,
  category text,
  image_url text
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  quantity_per_serving double precision not null default 0,
  unit text not null default 'unité',
  rayon text,
  category text,
  category_hint text
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);

create table public.purchase_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  -- drive_configs est abandonnée : on garde le nom de l'enseigne, pas une clé
  -- étrangère vers une table qui stockait des identifiants.
  drive text not null,
  quantity_ordered integer not null default 0,
  quantity_delivered integer not null default 0,
  unit_price_ttc numeric(10, 2),
  total_ttc numeric(10, 2),
  purchase_date date,
  created_at timestamptz not null default now()
);
create index purchase_lines_product_idx on public.purchase_lines (product_id, purchase_date desc);

-- Équivalence d'un produit chez une enseigne donnée.
-- Indispensable côté Leclerc : ses liens produit n'ont pas de href, donc aucun
-- EAN n'est lisible dans l'URL et l'accès direct par code-barres est impossible.
create table public.product_equivalents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  drive text not null check (drive in ('carrefour', 'leclerc')),
  search_query text,
  matched_label text,
  product_url text,
  ean13 text,
  unavailable boolean not null default false,
  last_confirmed_at timestamptz,
  unique (user_id, product_id, drive)
);

-- updated_at automatique, via la fonction déjà durcie (security invoker)
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();
create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

-- RLS : une clause unique par table, volontairement identique partout.
alter table public.categories enable row level security;
alter table public.category_aliases enable row level security;
alter table public.products enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.purchase_lines enable row level security;
alter table public.product_equivalents enable row level security;

create policy "owner all" on public.categories for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "owner all" on public.category_aliases for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "owner all" on public.products for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "owner all" on public.recipes for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "owner all" on public.recipe_ingredients for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "owner all" on public.purchase_lines for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "owner all" on public.product_equivalents for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
```

- [ ] **Step 2: Appliquer la migration**

Utiliser l'outil MCP Supabase `apply_migration` avec `project_id: qmymwicsgilhoihtfdjm`, `name: catalogue_et_rls`, et le contenu SQL ci-dessus.

Attendu : `{"success": true}`

- [ ] **Step 3: Vérifier que RLS est active partout**

Via `execute_sql` :

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Attendu : `rowsecurity = true` pour les 8 tables (les 7 nouvelles plus `cart_jobs`).

- [ ] **Step 4: Vérifier l'absence de faille signalée**

Utiliser l'outil `get_advisors` avec `type: security`.

Attendu : `{"result":{"lints":[]}}`. Toute alerte doit être corrigée avant de continuer — ne pas passer outre.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_catalogue.sql
git commit -m "feat: schéma Supabase du catalogue avec RLS par utilisateur

Sept tables migrées depuis SQLite, chacune cloisonnée par user_id avec une
clause RLS unique et identique — le partage foyer se fera en remplaçant cette
seule clause.

drive_configs n'est pas reprise : purchase_lines garde le nom de l'enseigne
dans une colonne texte au lieu d'une clé étrangère vers une table qui
stockait des identifiants de drive.

product_equivalents gagne matched_label et unavailable : chez Leclerc les
liens produit n'ont pas de href, donc aucun accès direct par EAN n'est
possible et l'équivalence doit être mémorisée par son libellé."
```

---

### Task 2: Migration des données SQLite vers Supabase

**Files:**
- Create: `scripts/generer_migration_donnees.mjs`
- Create: `supabase/migrations/0004_donnees_initiales.sql` (produit par le script)
- Create: `scripts/README.md`

**Interfaces:**
- Consomme : les tables créées en Task 1.
- Produit : un catalogue peuplé — 65 produits, 10 catégories, 10 alias, 5 recettes, 26 ingrédients, 65 lignes d'achat.

**Note d'exécution :** le plan prévoyait initialement un script Node écrivant
directement dans Supabase avec la clé `service_role`. Cette clé n'est
accessible nulle part dans l'environnement, et la faire transiter serait
contraire au principe « aucun secret stocké » du projet. L'approche retenue
génère à la place un fichier SQL, appliqué par `apply_migration` : aucun
secret, un artefact versionné et relisible, et les identifiants UUID fixés à
la génération plutôt que tirés à l'exécution — ce qui rend la migration
rejouable à l'identique.

- [ ] **Step 1: Écrire le générateur**

Créer `scripts/generer_migration_donnees.mjs` :

```js
/**
 * Génère la migration SQL de reprise des données depuis SQLite.
 *
 * N'écrit rien en base : produit un fichier SQL, appliqué ensuite par
 * apply_migration. Les UUID sont fixés ici, à la génération, de sorte que le
 * fichier soit rejouable à l'identique et que les liens entre produits,
 * recettes et ingrédients soient lisibles dans le SQL lui-même.
 *
 * Usage : node scripts/generer_migration_donnees.mjs <user_id> > fichier.sql
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const USER_ID = process.argv[2];
if (!/^[0-9a-f-]{36}$/i.test(USER_ID ?? '')) {
  throw new Error('Usage : node scripts/generer_migration_donnees.mjs <user_id>');
}

const db = new DatabaseSync('backend/app.db', { readOnly: true });
const lire = (sql) => db.prepare(sql).all();

/** Échappe une valeur pour l'insérer littéralement dans du SQL. */
function q(v) {
  if (v === null || v === undefined || v === '') return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
}

const lignes = [];
const ecrire = (s) => lignes.push(s);

ecrire('-- Reprise des données depuis SQLite (backend/app.db).');
ecrire('-- Généré par scripts/generer_migration_donnees.mjs — ne pas éditer à la main.');
ecrire(`-- Propriétaire : ${USER_ID}`);
ecrire('');

// --- Catégories ---
const categories = lire('select * from categories');
for (const c of categories) {
  ecrire(
    `insert into public.categories (user_id, key, label, icon, display_order) values ` +
    `(${q(USER_ID)}, ${q(c.key)}, ${q(c.label)}, ${q(c.icon ?? '')}, ${c.display_order ?? 0});`,
  );
}

// --- Alias de catégories ---
for (const a of lire('select * from category_aliases')) {
  ecrire(
    `insert into public.category_aliases (user_id, label_raw, key_canonical) values ` +
    `(${q(USER_ID)}, ${q(a.label_raw)}, ${q(a.key_canonical)});`,
  );
}

// --- Produits : l'id entier devient un UUID fixé ici ---
const idProduit = new Map();
for (const p of lire('select * from products')) {
  const id = randomUUID();
  idProduit.set(p.id, id);
  ecrire(
    `insert into public.products (id, user_id, ean13, name, brand, category, ` +
    `default_quantity, unit, favorite, notes, price_ttc, image_url, brand_type, ` +
    `store_brand_affinity, grammage_g, volume_ml, product_type) values (` +
    [
      q(id), q(USER_ID), q(p.ean13), q(p.name), q(p.brand), q(p.category),
      p.default_quantity ?? 1, q(p.unit || 'piece'), q(Boolean(p.favorite)),
      q(p.notes), q(p.price_ttc), q(p.image_url), q(p.brand_type || 'common'),
      q(p.store_brand_affinity), q(p.grammage_g), q(p.volume_ml), q(p.product_type),
    ].join(', ') + ');',
  );
}

// --- Recettes ---
const idRecette = new Map();
for (const r of lire('select * from recipes')) {
  const id = randomUUID();
  idRecette.set(r.id, id);
  ecrire(
    `insert into public.recipes (id, user_id, name, description, servings_default, ` +
    `category, image_url) values (` +
    [
      q(id), q(USER_ID), q(r.name), q(r.description),
      r.servings_default ?? 4, q(r.category), q(r.image_url),
    ].join(', ') + ');',
  );
}

// --- Ingrédients : rattachés par les UUID générés ci-dessus ---
let ingredientsIgnores = 0;
for (const i of lire('select * from recipe_ingredients')) {
  const recipeId = idRecette.get(i.recipe_id);
  if (!recipeId) { ingredientsIgnores += 1; continue; }
  ecrire(
    `insert into public.recipe_ingredients (user_id, recipe_id, product_id, name, ` +
    `quantity_per_serving, unit, rayon, category, category_hint) values (` +
    [
      q(USER_ID), q(recipeId),
      q(i.product_id ? idProduit.get(i.product_id) ?? null : null),
      q(i.name), i.quantity_per_serving ?? 0, q(i.unit || 'unité'),
      q(i.rayon), q(i.category), q(i.category_hint),
    ].join(', ') + ');',
  );
}

// --- Lignes d'achat : drive_config_id devient le nom de l'enseigne ---
const drives = new Map(lire('select id, name from drive_configs').map((d) => [d.id, d.name]));
let achatsIgnores = 0;
for (const l of lire('select * from purchase_lines')) {
  const productId = idProduit.get(l.product_id);
  if (!productId) { achatsIgnores += 1; continue; }
  ecrire(
    `insert into public.purchase_lines (user_id, product_id, drive, quantity_ordered, ` +
    `quantity_delivered, unit_price_ttc, total_ttc, purchase_date) values (` +
    [
      q(USER_ID), q(productId), q(drives.get(l.drive_config_id) ?? 'carrefour'),
      l.quantity_ordered ?? 0, l.quantity_delivered ?? 0,
      q(l.unit_price_ttc), q(l.total_ttc), q(l.purchase_date),
    ].join(', ') + ');',
  );
}

db.close();

// Les lignes orphelines partent sur stderr : elles ne doivent pas polluer le
// SQL, mais elles ne doivent pas non plus disparaître en silence.
if (ingredientsIgnores || achatsIgnores) {
  console.error(
    `Ignorés — ingrédients sans recette : ${ingredientsIgnores}, ` +
    `lignes d'achat sans produit : ${achatsIgnores}`,
  );
}
console.log(lignes.join('\n'));
```

- [ ] **Step 2: Documenter le script**

Créer `scripts/README.md` :

```markdown
# Scripts

## generer_migration_donnees.mjs

Génère la migration SQL de reprise des données depuis `backend/app.db`
(SQLite). N'écrit rien en base : produit un fichier appliqué ensuite par
`apply_migration`.

```bash
node scripts/generer_migration_donnees.mjs <user_id> \
  > supabase/migrations/0004_donnees_initiales.sql
```

Le `user_id` est l'UUID du compte propriétaire, lisible dans le tableau de
bord Supabase, section Authentication > Users.

Les UUID des produits et recettes sont fixés à la génération : le fichier est
donc rejouable à l'identique, et les liens entre tables restent lisibles dans
le SQL. Le regénérer produirait de nouveaux identifiants — ce qui créerait des
doublons si la première migration a déjà été appliquée.
```

- [ ] **Step 3: Récupérer l'identifiant du compte**

Via l'outil MCP `execute_sql` :

```sql
select id, email from auth.users order by created_at limit 5;
```

Noter l'UUID de `angelo.blot@gmail.com`.

- [ ] **Step 4: Générer la migration**

```bash
node scripts/generer_migration_donnees.mjs <uuid> \
  > supabase/migrations/0004_donnees_initiales.sql
wc -l supabase/migrations/0004_donnees_initiales.sql
```

Attendu : 185 lignes d'insertion environ (10 + 10 + 65 + 5 + 26 + 65 = 181, plus l'en-tête). Aucun message sur stderr — toute ligne ignorée serait signalée.

- [ ] **Step 5: Contrôler le SQL généré avant de l'appliquer**

```bash
head -6 supabase/migrations/0004_donnees_initiales.sql
grep -c "^insert into public.products" supabase/migrations/0004_donnees_initiales.sql
grep -c "^insert into public.recipe_ingredients" supabase/migrations/0004_donnees_initiales.sql
grep -n "''" supabase/migrations/0004_donnees_initiales.sql | head -3
```

Attendu : 65 produits, 26 ingrédients. Les apostrophes doublées sont normales — elles signalent que l'échappement fonctionne sur des noms comme « Classic'ade ».

- [ ] **Step 6: Appliquer la migration**

Avec l'outil MCP `apply_migration`, `project_id: qmymwicsgilhoihtfdjm`, `name: donnees_initiales`, et le contenu du fichier généré.

Attendu : `{"success": true}`

- [ ] **Step 7: Vérifier les décomptes en base**

Via `execute_sql` :

```sql
select 'products' t, count(*) n from products
union all select 'categories', count(*) from categories
union all select 'category_aliases', count(*) from category_aliases
union all select 'recipes', count(*) from recipes
union all select 'recipe_ingredients', count(*) from recipe_ingredients
union all select 'purchase_lines', count(*) from purchase_lines
order by t;
```

Attendu : `category_aliases 10`, `categories 10`, `products 65`, `purchase_lines 65`, `recipe_ingredients 26`, `recipes 5`.

Vérifier ensuite l'intégrité des liens :

```sql
select
  (select count(*) from recipe_ingredients where recipe_id is null) as ingredients_orphelins,
  (select count(*) from purchase_lines where product_id is null) as achats_orphelins,
  (select count(*) from products where ean13 is not null) as produits_avec_ean,
  (select count(distinct user_id) from products) as proprietaires;
```

Attendu : `0`, `0`, `65`, `1`. Le troisième décompte confirme que tous les produits ont conservé leur code-barres — c'est ce qui rend l'accès direct au panier Carrefour possible.

- [ ] **Step 8: Commit**

```bash
git add scripts/ supabase/migrations/0004_donnees_initiales.sql
git commit -m "feat: reprise des données SQLite dans Supabase

Le générateur produit un fichier SQL plutôt que d'écrire en base : aucune
clé service_role à faire transiter, un artefact versionné et relisible, et
des UUID fixés à la génération qui rendent la migration rejouable et les
liens entre tables lisibles dans le SQL.

drive_config_id est résolu en nom d'enseigne : la table drive_configs, qui
stockait les identifiants de drive, n'est pas reprise.

Les lignes orphelines seraient signalées sur stderr plutôt qu'ignorées en
silence ; il n'y en a aucune."
```

---

## Lot 2 — Application Expo : authentification et catalogue

### Task 3: Squelette Expo, client Supabase et écran de connexion

**Files:**
- Create: `mobile/` (via `create-expo-app`)
- Create: `mobile/lib/supabase.ts`
- Create: `mobile/lib/theme.ts`
- Create: `mobile/app/_layout.tsx`
- Create: `mobile/app/login.tsx`
- Create: `mobile/.env`
- Modify: `.gitignore`

**Interfaces:**
- Produit : `supabase` (client `SupabaseClient`), `useSession(): Session | null`, et les jetons de thème `colors`, `spacing`, `radius`.

- [ ] **Step 1: Créer le projet Expo**

```bash
cd /Users/angel-assistant/app-saas/courses-app
npx create-expo-app@latest mobile --template default
cd mobile && npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

Attendu : `mobile/` créé avec expo-router, TypeScript et un dossier `app/`.

- [ ] **Step 2: Ignorer les fichiers sensibles et volumineux**

Ajouter à la fin de `.gitignore` :

```
# Expo
mobile/.expo/
mobile/node_modules/
mobile/ios/
mobile/android/
mobile/.env
```

- [ ] **Step 3: Autoriser les extensions .ts dans les imports**

Dans `mobile/tsconfig.json`, ajouter sous `compilerOptions` :

```json
"allowImportingTsExtensions": true
```

Sans cette option, TypeScript refuse `from './typology.ts'` — or cette
extension est indispensable pour que `node --test` résolve les modules.

- [ ] **Step 4: Écrire la configuration d'environnement**

Créer `mobile/.env` :

```
EXPO_PUBLIC_SUPABASE_URL=https://qmymwicsgilhoihtfdjm.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_PueJWmalqhZO0ctPu95GKQ_EaAgVulr
```

Créer `mobile/.env.example` avec les mêmes clés, valeurs vidées.

- [ ] **Step 5: Écrire le client Supabase**

Créer `mobile/lib/supabase.ts` :

```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  // Échec bruyant au démarrage : une application qui tourne sans
  // configuration donnerait des écrans vides sans cause visible.
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY doivent être définies (voir mobile/.env.example)',
  );
}

export const supabase = createClient(url, key, {
  auth: {
    // AsyncStorage est indispensable en React Native : sans lui la session
    // est perdue à chaque redémarrage de l'application.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 6: Écrire les jetons de thème**

Créer `mobile/lib/theme.ts` :

```ts
/** Reprend les variables du front web, pour que les deux se ressemblent. */
export const colors = {
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  border: '#E6E4DF',
  text: '#1C1C1A',
  textMuted: '#6B6B6B',
  accent: '#2D6A4F',
  accentSoft: '#E6EFE9',
  accentContrast: '#FFFFFF',
  danger: '#B3261E',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;
```

- [ ] **Step 7: Écrire la racine de navigation**

Remplacer `mobile/app/_layout.tsx` :

```tsx
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  // 'inconnue' tant que la session stockée n'est pas relue : sans cet état on
  // afficherait brièvement l'écran de connexion à quelqu'un de déjà connecté.
  const [pret, setPret] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setPret(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!pret) return;
    const surLogin = segments[0] === 'login';
    if (!session && !surLogin) router.replace('/login');
    if (session && surLogin) router.replace('/');
  }, [pret, session, segments, router]);

  if (!pret) return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 8: Écrire l'écran de connexion**

Créer `mobile/app/login.tsx` :

```tsx
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../lib/theme';

const MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou mot de passe incorrect.',
  'Email not confirmed': 'Confirme ton adresse via le lien reçu par e-mail.',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const connecter = async () => {
    if (enCours) return;
    setEnCours(true);
    setErreur(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: motDePasse,
    });
    if (error) setErreur(MESSAGES[error.message] ?? error.message);
    setEnCours(false);
  };

  return (
    <KeyboardAvoidingView
      style={s.ecran}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.carte}>
        <Text style={s.titre}>Courses</Text>
        <Text style={s.sousTitre}>Les courses du foyer, du canapé au drive.</Text>

        <Text style={s.label}>Adresse e-mail</Text>
        <TextInput
          style={s.champ}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <Text style={s.label}>Mot de passe</Text>
        <TextInput
          style={s.champ}
          value={motDePasse}
          onChangeText={setMotDePasse}
          secureTextEntry
          textContentType="password"
        />

        {erreur && <Text style={s.erreur}>{erreur}</Text>}

        <Pressable style={s.bouton} onPress={connecter} disabled={enCours}>
          {enCours
            ? <ActivityIndicator color={colors.accentContrast} />
            : <Text style={s.boutonTexte}>Se connecter</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bg },
  carte: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  titre: { fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center' },
  sousTitre: {
    fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg,
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
});
```

- [ ] **Step 9: Lancer et vérifier sur l'iPhone**

```bash
cd mobile && npx expo start
```

Scanner le QR code avec l'appareil photo de l'iPhone (Expo Go installé depuis l'App Store).

Attendu :
1. L'écran de connexion s'affiche, sans emoji, fond crème.
2. Un mauvais mot de passe affiche « E-mail ou mot de passe incorrect. »
3. Les bons identifiants font disparaître l'écran de connexion.
4. Fermer et rouvrir Expo Go : la session est conservée, pas de retour au login.

Le point 4 est le plus important : il valide qu'AsyncStorage est bien branché.

- [ ] **Step 10: Commit**

```bash
git add mobile .gitignore
git commit -m "feat: squelette Expo avec authentification Supabase

Client supabase-js adossé à AsyncStorage — sans lui la session serait perdue
à chaque redémarrage. La racine de navigation attend d'avoir relu la session
stockée avant de décider où aller, ce qui évite d'afficher l'écran de
connexion à quelqu'un de déjà connecté.

Les jetons de thème reprennent les couleurs du front web."
```

---

### Task 4: Portage de la typologie produit

**Files:**
- Create: `mobile/lib/typology.ts`
- Create: `mobile/lib/typology.test.mjs`

**Interfaces:**
- Produit : `normalizeProductType(name: string | null): string | null`.
- Consommé par la Task 7 (création d'un produit scanné).

- [ ] **Step 1: Écrire les tests d'abord**

Créer `mobile/lib/typology.test.mjs` :

```js
/**
 * Vérifie le portage de product_typology.py.
 * Lancer : node --test mobile/lib/typology.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProductType } from './typology.ts';

test('reconnaît la charcuterie', () => {
  assert.equal(normalizeProductType('Lardons fumés Herta'), 'lardon');
  assert.equal(normalizeProductType('Allumettes de bacon'), 'lardon');
  assert.equal(normalizeProductType('Chorizo doux'), 'charcuterie');
});

test('reconnaît les pâtes et le riz', () => {
  assert.equal(normalizeProductType('Spaghetti Barilla 500g'), 'pate');
  assert.equal(normalizeProductType('Riz basmati'), 'riz');
});

test('les ravioles sont des pâtes, pas du fromage', () => {
  // La règle est placée avant celle du fromage, qui matcherait « fromage »
  // dans « ravioles au fromage ».
  assert.equal(normalizeProductType('Ravioles au fromage'), 'pate');
});

test('un nom inconnu retombe sur son premier mot significatif', () => {
  assert.equal(normalizeProductType('Tarama de cabillaud'), 'tarama');
});

test('les mots vides sont ignorés dans le repli', () => {
  assert.equal(normalizeProductType('Bio Carrefour tarama'), 'tarama');
});

test('un nom vide ne produit rien', () => {
  assert.equal(normalizeProductType(''), null);
  assert.equal(normalizeProductType(null), null);
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

```bash
cd mobile && node --experimental-strip-types --test lib/typology.test.mjs
```

Attendu : échec, `Cannot find module './typology.ts'`.

- [ ] **Step 3: Porter le module**

Créer `mobile/lib/typology.ts`. Les règles sont reprises **à l'identique** de `backend/app/services/product_typology.py` — l'ordre compte, les règles spécifiques avant les génériques :

```ts
/**
 * Typologie automatique des produits, portée de product_typology.py.
 *
 * Extrait un type sémantique normalisé depuis le nom d'un produit, ce qui
 * permet de rapprocher un ingrédient de recette d'un produit du catalogue.
 */

/** (mots-clés, type associé). L'ordre compte : spécifique avant générique. */
const TYPE_RULES: Array<[string[], string]> = [
  // Charcuterie
  [['allumette', 'lardon', 'bacon', 'poitrine'], 'lardon'],
  [['chorizo', 'saucisson', 'saucisse', 'rosette'], 'charcuterie'],
  [['pancetta', 'coppa', 'prosciutto'], 'charcuterie'],
  // Pates & riz
  [['spaghetti', 'tortellini', 'gnocchi', 'tagliatelle', 'penne', 'fusilli'], 'pate'],
  [['coude', 'macaroni', 'farfalle', 'conchiglie'], 'pate'],
  [['riz', 'risotto', 'arborio', 'basmati', 'jasmine', 'thai'], 'riz'],
  // Produits laitiers (SAUF lait et beurre, trop generiques)
  [['creme liquide', 'creme fraiche'], 'creme liquide'],
  [['parmesan', 'parmigiano'], 'parmesan'],
  [['mozzarella', 'mozza', 'burrata'], 'mozzarella'],
  // Avant la règle « fromage » : « ravioles au fromage » sont des pâtes.
  [['raviole', 'ravioles'], 'pate'],  // avant fromage (contient "fromage")
  [['emmental', 'comte', 'gruyere'], 'fromage rape'],
  [['cheddar', 'gorgonzola', 'feta', 'fromage'], 'fromage'],
  [['yaourt', 'yaourt grec', 'skyr', 'fromage blanc', 'petit suisse'], 'yaourt'],
  // Oeufs
  [['oeuf', 'oeufs'], 'oeuf'],
  // Legumes
  [['oignon', 'oignons', 'echalote', 'cebette'], 'oignon'],
  [['carotte'], 'carotte'],
  [['pomme de terre', 'pommes de terre', 'patate'], 'pomme de terre'],
  [['tomate', 'tomates', 'tomate cerise', 'tomates cerises'], 'tomate'],
  [['salade', 'laitue', 'mache', 'roquette', 'mesclun'], 'salade'],
  [[' ail '], 'ail'],  // avec espaces pour eviter "volaille"
  // Fruits
  [['avocat'], 'avocat'],
  [['banane'], 'banane'],
  [['pomme'], 'pomme'],
  // Viandes
  [['filet de poulet', 'blanc de poulet', 'poulet', 'cuisse de poulet'], 'poulet'],
  [['boeuf', 'entrecote', 'faux-filet', 'rumsteck'], 'boeuf'],
  [['hache'], 'viande hachee'],
  [['jambon blanc', 'jambon fume', 'jambon cru'], 'jambon'],
  // Epicerie salee
  [['farine'], 'farine'],
  [['sucre'], 'sucre'],
  [['sel'], 'sel'],
  [['poivre noir', 'poivre blanc', 'poivre'], 'poivre'],
  [['huile d'olive'], 'huile d'olive'],
  [['huile'], 'huile'],
  [['vinaigre'], 'vinaigre'],
  [['moutarde'], 'moutarde'],
  [['bouillon'], 'bouillon'],
  [['sauce soja', 'soja'], 'sauce soja'],
  [['ketchup', 'mayonnaise'], 'condiment'],
  // Epicerie sucree (AVANT lait/beurre)
  [['biscuit', 'cookie', 'granola', 'petit beurre'], 'biscuit'],
  [['cereale', 'cereales', 'tresor', 'kellogg', 'chocapic'], 'cereale'],
  [['cafe', 'capsule', 'dolce gusto', 'nescafe', 'nespresso'], 'cafe'],
  [['pain de mie', 'pain', 'baguette', 'campagnard', 'schar'], 'pain'],
  [['chips', 'cacahuete', 'cacahuetes', 'aperitif', 'twinuts'], 'aperitif'],
  [['houmous', 'humous'], 'houmous'],
  // Frais
  [['muffin', 'muffins', 'pate feuillettee', 'pate a pizza', 'pate'], 'pate'],
  [['raviole', 'ravioles'], 'pate'],
  // Boissons
  [[' biere ', ' ipa ', ' tourtel '], 'biere'],
  [['vin blanc', 'vin rouge', 'rose', 'vin'], 'vin'],
  [['jus'], 'jus'],
  // Lait, beurre (EN DERNIER car trop generiques)
  [['beurre'], 'beurre'],
  [['lait'], 'lait'],
  // Hygiene
  [['gel douche', 'shampooing', 'shampoing', 'savon'], 'gel douche'],
  [['dentifrice'], 'dentifrice'],
  [['deodorant'], 'deodorant'],
  [['brosse a dent'], 'brosse a dents'],
  [[' brosse '], 'brosse a dents'],
  // Papier
  [['papier toilette', 'pq'], 'papier toilette'],
  [['mouchoir', 'mouchoirs'], 'mouchoirs'],
  [['essuie-tout', 'essuie tout', 'essuie main'], 'essuie-tout'],
  // Droguerie
  [['lingette', 'lingettes desinfectantes'], 'lingettes'],
  [['briquet', 'briquets', 'bic'], 'briquet'],
  [['recharge gaz', 'gaz'], 'recharge gaz'],
  [['sac', 'sacs reutilisables', 'sacs consignes'], 'sac'],
];

const STOPWORDS = new Set([
  'avec', 'bio', 'blanc', 'carrefour', 'cl', 'classic', "classic'",
  'confit', 'confits', 'eco', 'economique', 'epais', 'epaise', 'essential',
  'extra', 'familial', 'fines', 'fondant', 'format', 'frais', 'fume',
  'fumee', 'fumees', 'fumes', 'g', 'hac', 'hb', 'jaune', 'kg', 'l',
  'legere', 'lot', 'maxi', 'ml', 'nature', 'noir', 'pack', 'planet', 'pur',
  'rape', 'rouge', 'sans', 'sensation', 'simpl', 'soft', 'tranche',
  'tranches', 'x'
]);

const sansAccents = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const echappe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Extrait le type sémantique d'un produit depuis son nom.
 *
 * Les mots-clés de trois caractères ou moins sont cherchés comme mots entiers,
 * ce qui évite qu'« ail » matche « volaille ».
 */
export function normalizeProductType(name: string | null | undefined): string | null {
  if (!name) return null;
  const nom = sansAccents(name);
  if (!nom) return null;

  for (const [motsCles, type] of TYPE_RULES) {
    for (const motCle of motsCles) {
      if (motCle.length <= 3) {
        if (new RegExp(`(^|\\s)${echappe(motCle)}($|\\s)`).test(nom)) return type;
      } else if (motCle.includes(' ')) {
        if (new RegExp(`(^|\\s)${echappe(motCle)}`).test(nom)) return type;
      } else if (nom.includes(motCle)) {
        return type;
      }
    }
  }

  // Repli : premier mot significatif, hors mots vides et unités.
  const mots = nom
    .split(/\s+/)
    .filter((m) => m.length > 3 && !STOPWORDS.has(m) && !/^\d/.test(m));
  return mots[0] ?? null;
}
```

- [ ] **Step 4: Lancer les tests**

```bash
cd mobile && node --experimental-strip-types --test lib/typology.test.mjs
```

Attendu : `pass 6`, `fail 0`.


- [ ] **Step 5: Commit**

```bash
git add mobile/lib/typology.ts mobile/lib/typology.test.mjs
git commit -m "feat: portage de la typologie produit en TypeScript

Règles reprises à l'identique de product_typology.py, ordre compris — la
règle des ravioles doit précéder celle du fromage, sans quoi « ravioles au
fromage » serait classé en fromage.

Six tests, dont ce cas d'ordre et le repli sur le premier mot significatif."
```

---

### Task 5: Écran catalogue produits

**Files:**
- Create: `mobile/app/(tabs)/_layout.tsx`
- Create: `mobile/app/(tabs)/index.tsx`
- Create: `mobile/components/ProductRow.tsx`
- Create: `mobile/components/EtatVide.tsx`
- Create: `mobile/stores/products.ts`
- Delete: `mobile/app/index.tsx` et `mobile/app/explore.tsx` — écrans du gabarit
  Expo, en anglais. `app/index.tsx` entrerait de surcroît en conflit de route
  avec `app/(tabs)/index.tsx`, qui sert la même adresse.
- Delete: les composants orphelins du gabarit — `animated-icon*`, `app-tabs*`,
  `external-link`, `hint-row`, `themed-text`, `themed-view`, `web-badge`,
  `ui/collapsible`. Aucun n'est utilisé par le code écrit ici, et plusieurs
  portent du texte anglais.

**Interfaces:**
- Consomme : `supabase` (Task 3), `colors`/`spacing`/`radius` (Task 3).
- Produit : le type `Product`, et `useProducts()` renvoyant `{ produits, chargement, erreur, recharger }`.

- [ ] **Step 1: Écrire le magasin de produits**

Créer `mobile/stores/products.ts` :

```ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type Product = {
  id: string;
  ean13: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string;
  favorite: boolean;
  image_url: string | null;
  grammage_g: number | null;
  volume_ml: number | null;
  product_type: string | null;
};

const CHAMPS =
  'id, ean13, name, brand, category, unit, favorite, image_url, grammage_g, volume_ml, product_type';

export function useProducts() {
  const [produits, setProduits] = useState<Product[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    setChargement(true);
    const { data, error } = await supabase
      .from('products')
      .select(CHAMPS)
      .order('favorite', { ascending: false })
      .order('name');
    if (error) {
      // Pas de repli silencieux : un catalogue vide et une erreur réseau ne
      // doivent pas se ressembler à l'écran.
      setErreur(error.message);
      setProduits([]);
    } else {
      setErreur(null);
      setProduits(data as Product[]);
    }
    setChargement(false);
  }, []);

  useEffect(() => { recharger(); }, [recharger]);

  return { produits, chargement, erreur, recharger };
}
```

- [ ] **Step 2: Écrire l'état vide réutilisable**

Créer `mobile/components/EtatVide.tsx` :

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../lib/theme';

export function EtatVide({ titre, children }: { titre: string; children?: string }) {
  return (
    <View style={s.bloc}>
      <Text style={s.titre}>{titre}</Text>
      {children && <Text style={s.corps}>{children}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  bloc: { padding: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  titre: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  corps: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
```

- [ ] **Step 3: Écrire la ligne produit**

Créer `mobile/components/ProductRow.tsx` :

```tsx
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Product } from '../stores/products';
import { colors, radius, spacing } from '../lib/theme';

/** Contenance lisible : « 200 g », « 1,5 L », ou rien. */
function contenance(p: Product): string | null {
  if (p.grammage_g) return `${p.grammage_g} g`;
  if (p.volume_ml) {
    return p.volume_ml >= 1000
      ? `${String(p.volume_ml / 1000).replace('.', ',')} L`
      : `${p.volume_ml} ml`;
  }
  return null;
}

export function ProductRow({ produit }: { produit: Product }) {
  const detail = [produit.brand, contenance(produit)].filter(Boolean).join(' · ');
  return (
    <View style={s.ligne}>
      {produit.image_url
        ? <Image source={{ uri: produit.image_url }} style={s.image} />
        : <View style={[s.image, s.imageVide]} />}
      <View style={s.texte}>
        <Text style={s.nom} numberOfLines={2}>{produit.name}</Text>
        {detail.length > 0 && <Text style={s.detail}>{detail}</Text>}
      </View>
      {produit.favorite && <View style={s.pastille} />}
    </View>
  );
}

const s = StyleSheet.create({
  ligne: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  image: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.bg },
  imageVide: { borderWidth: 1, borderColor: colors.border },
  texte: { flex: 1, gap: 2 },
  nom: { fontSize: 15, fontWeight: '600', color: colors.text },
  detail: { fontSize: 13, color: colors.textMuted },
  pastille: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.accent },
});
```

- [ ] **Step 4: Écrire la navigation par onglets**

Créer `mobile/app/(tabs)/_layout.tsx` :

```tsx
import { Tabs } from 'expo-router';
import { colors } from '../../lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Produits' }} />
    </Tabs>
  );
}
```

- [ ] **Step 5: Écrire l'écran catalogue**

Créer `mobile/app/(tabs)/index.tsx` :

```tsx
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProductRow } from '../../components/ProductRow';
import { EtatVide } from '../../components/EtatVide';
import { useProducts } from '../../stores/products';
import { colors, spacing } from '../../lib/theme';

export default function Produits() {
  const { produits, chargement, erreur, recharger } = useProducts();

  if (chargement && produits.length === 0) {
    return (
      <SafeAreaView style={s.centre}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.ecran}>
      <View style={s.entete}>
        <Text style={s.titre}>Produits</Text>
        <Text style={s.compte}>{produits.length}</Text>
      </View>

      {erreur && (
        <View style={s.erreur}>
          <Text style={s.erreurTexte}>Impossible de charger le catalogue.</Text>
          <Text style={s.erreurDetail}>{erreur}</Text>
          <Pressable onPress={recharger}><Text style={s.reessayer}>Réessayer</Text></Pressable>
        </View>
      )}

      <FlatList
        data={produits}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <ProductRow produit={item} />}
        ItemSeparatorComponent={() => <View style={s.separateur} />}
        refreshControl={
          <RefreshControl refreshing={chargement} onRefresh={recharger} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          erreur ? null : (
            <EtatVide titre="Aucun produit">
              Scanne un code-barres pour ajouter ton premier produit.
            </EtatVide>
          )
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  entete: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    padding: spacing.lg,
  },
  titre: { fontSize: 26, fontWeight: '800', color: colors.text },
  compte: { fontSize: 15, color: colors.textMuted },
  separateur: { height: 1, backgroundColor: colors.border, marginLeft: 76 },
  erreur: {
    margin: spacing.lg, padding: spacing.lg, borderRadius: 10,
    borderWidth: 1, borderColor: colors.danger, gap: spacing.xs,
  },
  erreurTexte: { color: colors.text, fontWeight: '600' },
  erreurDetail: { color: colors.textMuted, fontSize: 12 },
  reessayer: { color: colors.accent, fontWeight: '700', marginTop: spacing.sm },
});
```

- [ ] **Step 6: Supprimer les écrans et composants du gabarit**

Le gabarit Expo SDK 57 pose ses propres écrans à la racine de `app/`, en
anglais, et un jeu de composants de démonstration. `app/index.tsx` sert la
même route que `app/(tabs)/index.tsx` : le laisser créerait un conflit.

```bash
cd mobile
rm -f app/index.tsx app/explore.tsx app/+not-found.tsx
rm -f components/animated-icon.tsx components/animated-icon.web.tsx \
      components/animated-icon.module.css components/app-tabs.tsx \
      components/app-tabs.web.tsx components/external-link.tsx \
      components/hint-row.tsx components/themed-text.tsx \
      components/themed-view.tsx components/web-badge.tsx
rm -rf components/ui
```

Vérifier ensuite qu'aucune référence ne subsiste :

```bash
grep -rn "themed-text\|animated-icon\|app-tabs\|hint-row\|web-badge\|external-link\|collapsible" app components lib || echo "aucune référence orpheline"
```

Attendu : `aucune référence orpheline`.

- [ ] **Step 7: Vérifier sur l'iPhone**

```bash
cd mobile && npx expo start
```

Attendu :
1. Après connexion, la liste affiche **65 produits**, favoris en tête.
2. Chaque ligne montre nom, marque et contenance quand elle est connue.
3. Tirer vers le bas recharge la liste.
4. Aucun emoji nulle part.

Vérifier aussi le cloisonnement : sur le tableau de bord Supabase, créer un second compte, s'y connecter dans l'app, et constater **un catalogue vide** — c'est la preuve que RLS fonctionne.

- [ ] **Step 8: Commit**

```bash
git add mobile
git commit -m "feat: écran catalogue produits alimenté par Supabase

Liste triée favoris d'abord, avec image, marque et contenance. Les quatre
états sont distincts à l'écran : chargement, vide, erreur, contenu — une
erreur réseau ne doit pas ressembler à un catalogue vide.

Cloisonnement RLS vérifié : un second compte voit une liste vide."
```

---

## Lot 3 — Scan de codes-barres

### Task 6: Client Open Food Facts

**Files:**
- Create: `mobile/lib/openfoodfacts.ts`
- Create: `mobile/lib/openfoodfacts.test.mjs`

**Interfaces:**
- Consomme : `normalizeProductType` (Task 4).
- Produit :
  - `type FicheProduit = { ean13, name, brand, imageUrl, grammageG, volumeMl, productType }`
  - `mapOffProduct(ean: string, data: OffData): FicheProduit | null`
  - `lookupEan(ean: string): Promise<FicheProduit | null>`
  - `estLiquide(nom: string, categories?: string[]): boolean`

- [ ] **Step 1: Écrire les tests d'abord**

Créer `mobile/lib/openfoodfacts.test.mjs` :

```js
/**
 * Vérifie le mapping Open Food Facts, porté d'enrich_ean.py.
 * Ce sont des fonctions pures : aucun appel réseau ici.
 * Lancer : node --test mobile/lib/openfoodfacts.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapOffProduct, estLiquide } from './openfoodfacts.ts';

test('un solide reçoit un grammage', () => {
  const fiche = mapOffProduct('3760040427577', {
    product_name: 'Lardons fumés',
    brands: 'Herta',
    product_quantity: 200,
    image_url: 'https://exemple.test/i.jpg',
  });
  assert.equal(fiche.grammageG, 200);
  assert.equal(fiche.volumeMl, null);
  assert.equal(fiche.brand, 'Herta');
  assert.equal(fiche.productType, 'lardon');
});

test('un liquide reçoit un volume', () => {
  const fiche = mapOffProduct('123', {
    product_name: 'Lait demi-écrémé',
    product_quantity: 1000,
  });
  assert.equal(fiche.volumeMl, 1000);
  assert.equal(fiche.grammageG, null);
});

test('la catégorie Open Food Facts sert aussi à détecter un liquide', () => {
  assert.equal(estLiquide('Tropicana', ['en:beverages']), true);
});

test('une quantité absente ne bloque pas la fiche', () => {
  // Le produit reste ajoutable : la contenance se saisit à la main ensuite.
  const fiche = mapOffProduct('123', { product_name: 'Pain de mie' });
  assert.equal(fiche.grammageG, null);
  assert.equal(fiche.volumeMl, null);
  assert.equal(fiche.name, 'Pain de mie');
});

test('une quantité aberrante est ignorée', () => {
  const fiche = mapOffProduct('123', { product_name: 'Riz', product_quantity: -5 });
  assert.equal(fiche.grammageG, null);
});

test('une fiche sans nom est refusée', () => {
  // Sans nom, le produit serait inexploitable dans le catalogue.
  assert.equal(mapOffProduct('123', { product_name: '' }), null);
  assert.equal(mapOffProduct('123', {}), null);
});

test('la marque prend la première quand Open Food Facts en liste plusieurs', () => {
  const fiche = mapOffProduct('123', { product_name: 'Yaourt', brands: 'Danone,Activia' });
  assert.equal(fiche.brand, 'Danone');
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

```bash
cd mobile && node --experimental-strip-types --test lib/openfoodfacts.test.mjs
```

Attendu : échec, module introuvable.

- [ ] **Step 3: Écrire le module**

Créer `mobile/lib/openfoodfacts.ts` :

```ts
/**
 * Client Open Food Facts pour le scan.
 *
 * Le mapping est porté de backend/app/services/enrich_ean.py : détection des
 * liquides et affectation de la quantité en grammes ou en millilitres.
 */
import { normalizeProductType } from './typology.ts';

export type FicheProduit = {
  ean13: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  grammageG: number | null;
  volumeMl: number | null;
  productType: string | null;
};

type OffData = {
  product_name?: string;
  brands?: string;
  image_url?: string;
  product_quantity?: number | string;
  categories_tags?: string[];
};

const MOTS_LIQUIDES = [
  'lait', 'huile', 'creme', 'jus', 'soda', 'biere', 'vin', 'sauce', 'sirop',
  'boisson', 'limonade', 'yaourt', 'eau', 'nectar', 'smoothie', 'tonic',
];

const CATEGORIES_LIQUIDES = ['beverages', 'drinks', 'waters', 'juices', 'milks'];

const sansAccents = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Un produit est liquide si son nom ou sa catégorie Open Food Facts le dit. */
export function estLiquide(nom: string, categories: string[] = []): boolean {
  const n = sansAccents(nom);
  if (MOTS_LIQUIDES.some((m) => new RegExp(`(^|\\s)${m}`).test(n))) return true;
  return categories.some((c) => CATEGORIES_LIQUIDES.some((l) => c.includes(l)));
}

/**
 * Convertit une réponse Open Food Facts en fiche exploitable.
 *
 * @returns null si la fiche n'a pas de nom — un produit sans libellé serait
 *   inutilisable dans le catalogue, mieux vaut basculer sur la saisie manuelle.
 */
export function mapOffProduct(ean: string, data: OffData): FicheProduit | null {
  const name = (data.product_name ?? '').trim();
  if (!name) return null;

  const quantite = Number(data.product_quantity);
  const valide = Number.isFinite(quantite) && quantite > 0;
  const liquide = estLiquide(name, data.categories_tags ?? []);

  return {
    ean13: ean,
    name,
    // Open Food Facts liste parfois plusieurs marques séparées par des virgules.
    brand: (data.brands ?? '').split(',')[0].trim() || null,
    imageUrl: data.image_url || null,
    grammageG: valide && !liquide ? Math.round(quantite) : null,
    volumeMl: valide && liquide ? Math.round(quantite) : null,
    productType: normalizeProductType(name),
  };
}

const URL_OFF = 'https://world.openfoodfacts.org/api/v2/product';
const CHAMPS = 'product_name,brands,image_url,product_quantity,categories_tags';

/**
 * Interroge Open Food Facts pour un code-barres.
 *
 * @returns null si le produit est inconnu ou la réponse illisible. L'appelant
 *   bascule alors sur la saisie manuelle.
 */
export async function lookupEan(ean: string): Promise<FicheProduit | null> {
  try {
    const reponse = await fetch(`${URL_OFF}/${ean}.json?fields=${CHAMPS}`, {
      headers: { 'User-Agent': 'courses-app/1.0 (usage familial)' },
    });
    if (!reponse.ok) return null;
    const json = await reponse.json();
    if (json.status !== 1 || !json.product) return null;
    return mapOffProduct(ean, json.product);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Lancer les tests**

```bash
cd mobile && node --experimental-strip-types --test lib/openfoodfacts.test.mjs
```

Attendu : `pass 7`, `fail 0`.

- [ ] **Step 5: Vérifier contre l'API réelle**

```bash
curl -s "https://world.openfoodfacts.org/api/v2/product/3274080005003.json?fields=product_name,brands,product_quantity" | head -20
```

Attendu : une réponse JSON avec `product_name` renseigné (eau de source Cristaline). Confirme que le format de champs demandé est le bon.

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/openfoodfacts.ts mobile/lib/openfoodfacts.test.mjs
git commit -m "feat: client Open Food Facts pour le scan

Mapping porté d'enrich_ean.py : la quantité va en grammes ou en millilitres
selon que le produit est reconnu liquide, par son nom ou par sa catégorie
Open Food Facts.

Sept tests. Une fiche sans nom est refusée plutôt qu'ajoutée vide, une
quantité absente ou aberrante n'empêche pas l'ajout — la contenance se
complète à la main."
```

---

### Task 7: Écran de scan et ajout au catalogue

**Files:**
- Create: `mobile/app/(tabs)/scan.tsx`
- Create: `mobile/components/FicheScannee.tsx`
- Modify: `mobile/app/(tabs)/_layout.tsx`
- Modify: `mobile/stores/products.ts`

**Interfaces:**
- Consomme : `lookupEan`, `FicheProduit`, `ResultatRecherche` (Task 6), `useProducts` (Task 5).
- **Contrat de `lookupEan`, modifié en Task 6 :** il ne renvoie plus
  `FicheProduit | null` mais une union discriminée
  `{ etat: 'trouve'; fiche } | { etat: 'inconnu' } | { etat: 'hors_ligne' }`.
  La relecture avait relevé qu'un `null` unique rendait indiscernables un
  produit absent d'Open Food Facts et une panne réseau — or le premier appelle
  un formulaire de saisie, le second une mise en file d'attente.
- Produit : `ajouterProduit(fiche: FicheProduit): Promise<{ ok: boolean; doublon?: Product; erreur?: string }>`.

- [ ] **Step 1: Installer les dépendances natives**

```bash
cd mobile && npx expo install expo-camera expo-haptics
```

- [ ] **Step 2: Déclarer l'usage de la caméra**

Dans `mobile/app.json`, ajouter sous `expo.plugins` :

```json
[
  "expo-camera",
  {
    "cameraPermission": "L'appareil photo sert à scanner le code-barres de tes produits."
  }
]
```

Le texte est visible par l'utilisateur au moment de la demande : il doit dire pourquoi, pas seulement quoi.

- [ ] **Step 3: Ajouter la création de produit au magasin**

Ajouter à la fin de `mobile/stores/products.ts` :

```ts
import type { ResultatRecherche } from '../lib/openfoodfacts.ts';

/**
 * Ajoute un produit scanné au catalogue.
 *
 * Un code-barres déjà présent n'est pas réinséré : la contrainte
 * unique (user_id, ean13) le garantit en base, et on renvoie le produit
 * existant pour que l'écran le signale au lieu d'afficher une erreur brute.
 */
export async function ajouterProduit(
  fiche: FicheProduit,
): Promise<{ ok: boolean; doublon?: Product; erreur?: string }> {
  const { data: existant } = await supabase
    .from('products')
    .select(CHAMPS)
    .eq('ean13', fiche.ean13)
    .maybeSingle();

  if (existant) return { ok: false, doublon: existant as Product };

  const { error } = await supabase.from('products').insert({
    ean13: fiche.ean13,
    name: fiche.name,
    brand: fiche.brand,
    image_url: fiche.imageUrl,
    grammage_g: fiche.grammageG,
    volume_ml: fiche.volumeMl,
    product_type: fiche.productType,
    favorite: true, // un produit qu'on scanne chez soi est un produit qu'on aime
    unit: fiche.volumeMl ? 'l' : 'piece',
  });

  return error ? { ok: false, erreur: error.message } : { ok: true };
}
```

- [ ] **Step 4: Écrire la fiche du produit scanné**

Créer `mobile/components/FicheScannee.tsx` :

```tsx
import { useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import type { ResultatRecherche } from '../lib/openfoodfacts.ts';
import { colors, radius, spacing } from '../lib/theme';

type Props = {
  resultat: ResultatRecherche | null;
  ean: string;
  chargement: boolean;
  message: string | null;
  onAjouter: () => void;
  /** Saisie manuelle, quand Open Food Facts ne connaît pas le code. */
  onAjouterManuel: (nom: string, marque: string) => void;
  onIgnorer: () => void;
};

export function FicheScannee({
  resultat, ean, chargement, message, onAjouter, onAjouterManuel, onIgnorer,
}: Props) {
  const [nom, setNom] = useState('');
  const [marque, setMarque] = useState('');

  // Trois issues distinctes, trois écrans distincts : une fiche trouvée, un
  // produit qu'Open Food Facts ignore, et un réseau absent. Les confondre
  // priverait l'utilisateur de la bonne action à faire.
  const fiche = resultat?.etat === 'trouve' ? resultat.fiche : null;
  const horsLigne = resultat?.etat === 'hors_ligne';
  const contenance = fiche?.grammageG
    ? `${fiche.grammageG} g`
    : fiche?.volumeMl
      ? `${fiche.volumeMl} ml`
      : null;

  return (
    <View style={s.panneau}>
      {chargement ? (
        <View style={s.centre}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.attente}>Recherche du produit…</Text>
        </View>
      ) : fiche ? (
        <>
          <View style={s.entete}>
            {fiche.imageUrl
              ? <Image source={{ uri: fiche.imageUrl }} style={s.image} />
              : <View style={[s.image, s.imageVide]} />}
            <View style={s.texte}>
              <Text style={s.nom} numberOfLines={2}>{fiche.name}</Text>
              <Text style={s.detail}>
                {[fiche.brand, contenance].filter(Boolean).join(' · ') || ean}
              </Text>
            </View>
          </View>

          {message && <Text style={s.message}>{message}</Text>}

          <View style={s.actions}>
            <Pressable style={[s.bouton, s.secondaire]} onPress={onIgnorer}>
              <Text style={s.secondaireTexte}>Ignorer</Text>
            </Pressable>
            <Pressable style={[s.bouton, s.principal]} onPress={onAjouter}>
              <Text style={s.principalTexte}>Ajouter aux favoris</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          {/* Produit inconnu et réseau absent appellent la même action — une
              saisie manuelle — mais pas la même explication : dans un cas le
              produit n'existe pas au catalogue Open Food Facts, dans l'autre
              on n'a pas pu le lui demander. */}
          <Text style={s.nom}>
            {horsLigne ? 'Réseau indisponible' : 'Produit inconnu'}
          </Text>
          <Text style={s.detail}>
            {horsLigne
              ? `Impossible de joindre Open Food Facts pour le code ${ean}. Ajoute le produit à la main, il entrera quand même dans ton catalogue.`
              : `Open Food Facts ne connaît pas le code ${ean}. Ajoute-le à la main : il entrera quand même dans ton catalogue.`}
          </Text>

          <Text style={s.label}>Nom du produit</Text>
          <TextInput
            style={s.champ}
            value={nom}
            onChangeText={setNom}
            placeholder="Lardons fumés"
            placeholderTextColor={colors.textMuted}
            autoFocus
          />

          <Text style={s.label}>Marque</Text>
          <TextInput
            style={s.champ}
            value={marque}
            onChangeText={setMarque}
            placeholder="Herta"
            placeholderTextColor={colors.textMuted}
          />

          {message && <Text style={s.message}>{message}</Text>}

          <View style={s.actions}>
            <Pressable style={[s.bouton, s.secondaire]} onPress={onIgnorer}>
              <Text style={s.secondaireTexte}>Fermer</Text>
            </Pressable>
            <Pressable
              style={[s.bouton, s.principal, !nom.trim() && s.desactive]}
              onPress={() => onAjouterManuel(nom.trim(), marque.trim())}
              disabled={!nom.trim()}
            >
              <Text style={s.principalTexte}>Ajouter</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  panneau: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface, padding: spacing.xl,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, gap: spacing.md,
  },
  centre: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  attente: { color: colors.textMuted, fontSize: 14 },
  entete: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  image: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.bg },
  imageVide: { borderWidth: 1, borderColor: colors.border },
  texte: { flex: 1, gap: spacing.xs },
  nom: { fontSize: 17, fontWeight: '700', color: colors.text },
  detail: { fontSize: 14, color: colors.textMuted },
  message: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  bouton: { flex: 1, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  principal: { backgroundColor: colors.accent },
  principalTexte: { color: colors.accentContrast, fontWeight: '700' },
  secondaire: { borderWidth: 1, borderColor: colors.border },
  secondaireTexte: { color: colors.textMuted, fontWeight: '600' },
  desactive: { opacity: 0.4 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: spacing.xs },
  champ: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: 16, color: colors.text,
  },
});
```

- [ ] **Step 5: Écrire l'écran de scan**

Créer `mobile/app/(tabs)/scan.tsx` :

```tsx
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FicheScannee } from '../../components/FicheScannee';
import { lookupEan, type FicheProduit, type ResultatRecherche } from '../../lib/openfoodfacts.ts';
import { normalizeProductType } from '../../lib/typology.ts';
import { ajouterProduit } from '../../stores/products';
import { colors, radius, spacing } from '../../lib/theme';

export default function Scan() {
  const [permission, demanderPermission] = useCameraPermissions();
  const [ean, setEan] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatRecherche | null>(null);
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reprendre = useCallback(() => {
    setEan(null);
    setResultat(null);
    setMessage(null);
  }, []);

  const surLecture = useCallback(
    async ({ data }: { data: string }) => {
      // La caméra émet en continu : sans ce garde, un même code déclencherait
      // des dizaines de requêtes pendant qu'on le tient devant l'objectif.
      if (ean || chargement) return;
      setEan(data);
      setChargement(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResultat(await lookupEan(data));
      setChargement(false);
    },
    [ean, chargement],
  );

  /** Enregistre une fiche, quelle que soit son origine. */
  const enregistrer = useCallback(
    async (aEnregistrer: FicheProduit) => {
      const r = await ajouterProduit(aEnregistrer);
      if (r.ok) {
        setMessage('Ajouté à tes favoris');
        setTimeout(reprendre, 1200);
      } else if (r.doublon) {
        setMessage(`Déjà dans ton catalogue : ${r.doublon.name}`);
      } else {
        setMessage(r.erreur ?? 'Ajout impossible');
      }
    },
    [reprendre],
  );

  const ajouter = useCallback(() => {
    if (resultat?.etat === 'trouve') enregistrer(resultat.fiche);
  }, [resultat, enregistrer]);

  /** Produit absent d'Open Food Facts : on compose la fiche depuis la saisie. */
  const ajouterManuel = useCallback(
    (nom: string, marque: string) => {
      if (!ean || !nom) return;
      enregistrer({
        ean13: ean,
        name: nom,
        brand: marque || null,
        imageUrl: null,
        grammageG: null,
        volumeMl: null,
        productType: normalizeProductType(nom),
      });
    },
    [ean, enregistrer],
  );

  if (!permission) return <SafeAreaView style={s.ecran} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={[s.ecran, s.centre]}>
        <Text style={s.titre}>Accès à l'appareil photo</Text>
        <Text style={s.corps}>
          Le scan a besoin de la caméra pour lire les codes-barres de tes produits.
        </Text>
        <Pressable style={s.bouton} onPress={demanderPermission}>
          <Text style={s.boutonTexte}>Autoriser</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={s.ecran}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8'] }}
        onBarcodeScanned={ean ? undefined : surLecture}
      />
      <SafeAreaView style={s.consigne} pointerEvents="none">
        <Text style={s.consigneTexte}>Vise le code-barres du produit</Text>
      </SafeAreaView>

      {ean && (
        <FicheScannee
          resultat={resultat}
          ean={ean}
          chargement={chargement}
          message={message}
          onAjouter={ajouter}
          onAjouterManuel={ajouterManuel}
          onIgnorer={reprendre}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  centre: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  titre: { fontSize: 20, fontWeight: '700', color: colors.text },
  corps: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
  bouton: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.sm,
  },
  boutonTexte: { color: colors.accentContrast, fontWeight: '700' },
  consigne: { alignItems: 'center', paddingTop: spacing.xl },
  consigneTexte: {
    color: colors.accentContrast, fontSize: 15, fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm, borderRadius: radius.pill, overflow: 'hidden',
  },
});
```

- [ ] **Step 6: Déclarer l'onglet**

Ajouter dans `mobile/app/(tabs)/_layout.tsx`, après l'écran `index` :

```tsx
      <Tabs.Screen name="scan" options={{ title: 'Scan' }} />
```

- [ ] **Step 7: Vérifier sur l'iPhone avec de vrais produits**

```bash
cd mobile && npx expo start
```

Prendre trois produits dans les placards et vérifier :

1. **Produit connu** — la fiche remonte avec image, nom, marque, contenance. « Ajouter aux favoris » l'ajoute, l'onglet Produits le montre en tête de liste.
2. **Même produit rescanné** — le message « Déjà dans ton catalogue : … » s'affiche, aucun doublon n'est créé.
3. **Produit inconnu d'Open Food Facts** — le formulaire s'affiche avec le code lu. Saisir un nom, valider : le produit entre au catalogue avec son EAN. Le bouton reste inactif tant que le nom est vide.
4. Vibration à chaque lecture, et un code tenu devant l'objectif ne déclenche **qu'une** recherche.
5. Refuser la permission caméra puis rouvrir l'onglet : l'écran d'explication s'affiche, pas un écran noir.

- [ ] **Step 8: Commit**

```bash
git add mobile
git commit -m "feat: scan de codes-barres et ajout au catalogue

La caméra lit un EAN13, Open Food Facts renvoie la fiche, un geste l'ajoute
aux favoris. Un produit scanné chez soi est marqué favori d'emblée : c'est
tout le sens du geste.

Trois cas traités à l'écran plutôt qu'en erreur brute : produit déjà présent
(la contrainte unique en base le garantit, l'écran le dit), produit inconnu
d'Open Food Facts, et permission caméra refusée.

Un garde empêche la caméra de relancer une recherche en continu tant qu'un
code reste devant l'objectif."
```

---

### Task 8: File d'attente hors connexion

**Files:**
- Create: `mobile/lib/queue.ts`
- Create: `mobile/lib/queue.test.mjs`
- Modify: `mobile/app/(tabs)/scan.tsx`

**Interfaces:**
- Consomme : `FicheProduit` (Task 6), `ajouterProduit` (Task 7).
- Produit : `enfiler(fiche)`, `defiler(): Promise<FicheProduit[]>`, `viderFile()`, `taille(): Promise<number>`.

- [ ] **Step 1: Écrire les tests d'abord**

Créer `mobile/lib/queue.test.mjs` :

```js
/**
 * Vérifie la file d'attente hors connexion sur un stockage simulé.
 * Lancer : node --test mobile/lib/queue.test.mjs
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { creerFile } from './queue.ts';

/** Stockage en mémoire, à l'interface d'AsyncStorage. */
function stockageMemoire() {
  const m = new Map();
  return {
    getItem: async (k) => m.get(k) ?? null,
    setItem: async (k, v) => void m.set(k, v),
    removeItem: async (k) => void m.delete(k),
  };
}

let file;
beforeEach(() => { file = creerFile(stockageMemoire()); });

const fiche = (ean) => ({ ean13: ean, name: `Produit ${ean}`, brand: null,
  imageUrl: null, grammageG: null, volumeMl: null, productType: null });

test('une file neuve est vide', async () => {
  assert.equal(await file.taille(), 0);
  assert.deepEqual(await file.defiler(), []);
});

test('enfiler puis défiler restitue dans l\'ordre', async () => {
  await file.enfiler(fiche('1'));
  await file.enfiler(fiche('2'));
  const sorties = await file.defiler();
  assert.deepEqual(sorties.map((f) => f.ean13), ['1', '2']);
});

test('défiler ne vide pas la file', async () => {
  // Vider avant confirmation d'envoi perdrait les fiches en cas d'échec.
  await file.enfiler(fiche('1'));
  await file.defiler();
  assert.equal(await file.taille(), 1);
});

test('vider la file la remet à zéro', async () => {
  await file.enfiler(fiche('1'));
  await file.viderFile();
  assert.equal(await file.taille(), 0);
});

test('un même code-barres ne s\'accumule pas', async () => {
  await file.enfiler(fiche('1'));
  await file.enfiler(fiche('1'));
  assert.equal(await file.taille(), 1);
});

test('un stockage corrompu est traité comme une file vide', async () => {
  const s = stockageMemoire();
  await s.setItem('courses.file_scan', 'ceci n\'est pas du json');
  const f = creerFile(s);
  assert.deepEqual(await f.defiler(), []);
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

```bash
cd mobile && node --experimental-strip-types --test lib/queue.test.mjs
```

Attendu : échec, module introuvable.

- [ ] **Step 3: Écrire le module**

Créer `mobile/lib/queue.ts` :

```ts
/**
 * File d'attente des scans effectués hors connexion.
 *
 * Le stockage est injecté plutôt qu'importé, ce qui rend la file testable
 * sans React Native.
 */
import type { FicheProduit } from './openfoodfacts';

const CLE = 'courses.file_scan';

type Stockage = {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
  removeItem: (k: string) => Promise<void>;
};

export function creerFile(stockage: Stockage) {
  const lire = async (): Promise<FicheProduit[]> => {
    const brut = await stockage.getItem(CLE);
    if (!brut) return [];
    try {
      const v = JSON.parse(brut);
      return Array.isArray(v) ? v : [];
    } catch {
      // Un stockage corrompu ne doit pas bloquer l'application au démarrage.
      return [];
    }
  };

  return {
    async enfiler(fiche: FicheProduit) {
      const file = await lire();
      // Tenir le même produit devant l'objectif ne doit pas le empiler.
      if (file.some((f) => f.ean13 === fiche.ean13)) return;
      await stockage.setItem(CLE, JSON.stringify([...file, fiche]));
    },
    /** Lit sans vider : la file n'est purgée qu'après envoi confirmé. */
    defiler: lire,
    async viderFile() {
      await stockage.removeItem(CLE);
    },
    async taille() {
      return (await lire()).length;
    },
  };
}
```

- [ ] **Step 4: Lancer les tests**

```bash
cd mobile && node --experimental-strip-types --test lib/queue.test.mjs
```

Attendu : `pass 6`, `fail 0`.

- [ ] **Step 5: Brancher la file sur l'écran de scan**

Dans `mobile/app/(tabs)/scan.tsx`, ajouter l'import :

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { creerFile } from '../../lib/queue';

const file = creerFile(AsyncStorage);
```

Remplacer la fonction `ajouter` par :

```tsx
  const enregistrer = useCallback(
    async (aEnregistrer: FicheProduit) => {
      const r = await ajouterProduit(aEnregistrer);
      if (r.ok) {
        setMessage('Ajouté à tes favoris');
        setTimeout(reprendre, 1200);
      } else if (r.doublon) {
        setMessage(`Déjà dans ton catalogue : ${r.doublon.name}`);
      } else {
        // Échec probablement réseau : on met de côté plutôt que de perdre le scan.
        await file.enfiler(aEnregistrer);
        setMessage('Hors connexion — ajouté dès le retour du réseau');
        setTimeout(reprendre, 1600);
      }
    },
    [reprendre],
  );
```

Ajouter la reprise au montage de l'écran :

```tsx
  // Vide la file au retour sur l'écran : les scans mis de côté rejoignent
  // le catalogue sans que l'utilisateur ait à y penser.
  useEffect(() => {
    (async () => {
      const enAttente = await file.defiler();
      if (!enAttente.length) return;
      const restants = [];
      for (const f of enAttente) {
        const r = await ajouterProduit(f);
        if (!r.ok && !r.doublon) restants.push(f);
      }
      await file.viderFile();
      for (const f of restants) await file.enfiler(f);
    })();
  }, []);
```

- [ ] **Step 6: Vérifier sur l'iPhone**

1. Activer le mode avion.
2. Scanner un produit déjà connu d'Open Food Facts — la fiche vient du cache réseau ou l'écran « Produit inconnu » s'affiche ; dans les deux cas, l'ajout doit répondre « Hors connexion — ajouté dès le retour du réseau ».
3. Désactiver le mode avion, revenir sur l'onglet Scan.
4. Ouvrir l'onglet Produits : le produit mis de côté y figure.

- [ ] **Step 7: Commit**

```bash
git add mobile
git commit -m "feat: file d'attente des scans hors connexion

Un ajout qui échoue est mis de côté au lieu d'être perdu, puis rejoué au
retour sur l'écran de scan. La file n'est purgée qu'après envoi confirmé :
vider avant perdrait les fiches en cas d'échec.

Le stockage est injecté plutôt qu'importé, ce qui rend la file testable sans
React Native — six tests, dont le stockage corrompu qui ne doit pas bloquer
le démarrage."
```

---

## Vérification finale des trois lots

- [ ] **Tous les tests passent**

```bash
cd mobile && node --experimental-strip-types --test lib/*.test.mjs
```

Attendu : 19 tests au vert (6 typologie + 7 Open Food Facts + 6 file).

- [ ] **Le cloisonnement RLS tient**

Se connecter avec un second compte dans l'application : le catalogue doit être vide, et un scan doit créer un produit invisible au premier compte.

- [ ] **Le parcours complet fonctionne**

Connexion → onglet Produits (65 produits) → onglet Scan → scanner un produit des placards → il apparaît en tête du catalogue.

- [ ] **Aucun emoji dans l'interface**

```bash
grep -rnP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' mobile/app mobile/components mobile/lib || echo "aucun"
```

Attendu : `aucun`.

## Suite

Les lots 4 à 6 — portage du wizard, pont extension ↔ Supabase, retrait de FastAPI et du front web — feront l'objet de leurs propres plans, une fois le scan éprouvé à l'usage.
