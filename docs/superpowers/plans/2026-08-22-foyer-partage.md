# Partage du foyer — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour dérouler ce plan tâche par tâche. Les étapes
> emploient la syntaxe à cases (`- [ ]`).

**But :** faire passer les données d'une propriété individuelle à une propriété
de foyer, et permettre d'inviter quelqu'un par courriel.

**Architecture :** huit tables gagnent `household_id`, dont la valeur par défaut
est le foyer de l'appelant — les insertions de l'application continuent donc de
fonctionner sans une ligne de code modifiée. La clause RLS devient
`household_id = mon_foyer()`, une fonction `STABLE` évaluée une fois par requête
et non une fois par ligne. L'invitation passe par une fonction Edge, à qui
Supabase fournit la clé de service sans qu'on l'écrive nulle part.

**Pile :** Supabase Postgres 17, RLS, fonctions Edge (Deno), Expo SDK 57,
`node:test`.

**Spécification :** `docs/superpowers/specs/2026-08-22-foyer-partage-design.md`

## Contraintes globales

- **Tests : Node ≥ 22.** Depuis `mobile/` :
  `/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs`
- **La clé de service ne doit jamais être écrite, commitée, ni affichée.**
  Supabase l'injecte dans la fonction Edge sous `SUPABASE_SERVICE_ROLE_KEY`.
- **`user_id` n'est supprimé d'aucune table.** Il garde son intérêt, et son
  maintien rend la migration réversible.
- **Aucune nouvelle dépendance côté mobile.**
- **Zéro emoji.** Thème clair, jetons de `lib/theme.ts`, messages en français.
- **Ne rien pousser avant la tâche 6.** Xcode Cloud surveille `mobile/` sur
  `mobile/expo-scan` avec « Auto-cancel Builds ».
- **Projet Supabase :** `qmymwicsgilhoihtfdjm`.

---

### Tâche 1 : le modèle et la migration

**Fichiers :**
- Créer : `supabase/migrations/0010_foyer.sql`

**Interfaces :**
- Produit : tables `households`, `household_members` ; fonction
  `public.mon_foyer() returns uuid` ; colonne `household_id` sur huit tables.

- [x] **Étape 1 : constater l'état d'origine**

Par l'outil MCP Supabase :

```sql
select tablename, policyname, cmd, qual from pg_policies
where schemaname = 'public' order by tablename, cmd;
```

**Copier ce résultat dans le message de commit** : c'est la seule trace de ce
qu'étaient les politiques avant la bascule.

- [x] **Étape 2 : écrire la migration**

Créer `supabase/migrations/0010_foyer.sql` :

```sql
-- Les données passent d'une propriété individuelle à une propriété de foyer.
--
-- La conception du 18/08 avait écrit les politiques d'une seule façon —
-- `(select auth.uid()) = user_id`, identique sur sept tables — précisément pour
-- que ce jour-là ne coûte pas cher. C'est ce qui se vérifie ici.
--
-- `user_id` n'est supprimé nulle part : savoir qui a scanné quoi garde son
-- intérêt, et son maintien rend cette migration réversible.

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mon foyer',
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'membre' check (role in ('createur', 'membre')),
  invited_at timestamptz not null default now(),
  -- NULL tant que la personne n'a pas ouvert son lien d'invitation : elle
  -- apparaît alors « en attente » dans la liste.
  joined_at timestamptz,
  unique (household_id, user_id)
);

create index if not exists household_members_user_idx
  on public.household_members (user_id);

-- Un foyer par utilisateur existant, dont il est le créateur.
do $$
declare u record; f uuid;
begin
  for u in select id, email from auth.users loop
    if exists (select 1 from public.household_members where user_id = u.id) then
      continue;
    end if;
    insert into public.households (name)
    values ('Foyer de ' || coalesce(split_part(u.email, '@', 1), 'la maison'))
    returning id into f;
    insert into public.household_members (household_id, user_id, role, joined_at)
    values (f, u.id, 'createur', now());
  end loop;
end $$;

-- Le foyer de l'appelant.
--
-- `stable` est essentiel : sans lui, Postgres évaluerait l'appartenance une
-- fois par ligne — soixante-huit fois la même question pour afficher le
-- catalogue. `security definer` l'est aussi : la fonction lit
-- household_members, dont les politiques dépendraient sinon d'elle-même.
create or replace function public.mon_foyer()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id
  from public.household_members
  where user_id = (select auth.uid())
  limit 1;
$$;

-- La colonne, son remplissage, sa valeur par défaut, son index.
--
-- L'ordre compte : rendre la colonne obligatoire avant de l'avoir remplie
-- ferait échouer la migration entière.
--
-- La valeur par défaut est `mon_foyer()` : les insertions de l'application
-- continuent donc de fonctionner sans une ligne modifiée.
do $$
declare t text;
begin
  foreach t in array array[
    'products', 'recipes', 'recipe_ingredients', 'categories',
    'category_aliases', 'purchase_lines', 'product_equivalents', 'cart_jobs'
  ] loop
    execute format(
      'alter table public.%I add column if not exists household_id uuid
       references public.households(id) on delete cascade', t);
    execute format(
      'update public.%I x set household_id = m.household_id
       from public.household_members m
       where m.user_id = x.user_id and x.household_id is null', t);
    execute format(
      'alter table public.%I alter column household_id set not null', t);
    execute format(
      'alter table public.%I alter column household_id set default public.mon_foyer()', t);
    execute format(
      'create index if not exists %I on public.%I (household_id)',
      t || '_household_idx', t);
  end loop;
end $$;

-- Bascule des politiques : sept tables au même régime.
do $$
declare t text;
begin
  foreach t in array array[
    'products', 'recipes', 'recipe_ingredients', 'categories',
    'category_aliases', 'purchase_lines', 'product_equivalents'
  ] loop
    execute format('drop policy if exists "owner all" on public.%I', t);
    execute format('drop policy if exists "foyer all" on public.%I', t);
    execute format(
      'create policy "foyer all" on public.%I for all
       using (household_id = public.mon_foyer())
       with check (household_id = public.mon_foyer())', t);
  end loop;
end $$;

-- cart_jobs garde ses quatre politiques distinctes : leurs conditions de statut
-- portent des garanties que « for all » effacerait.
drop policy if exists "select own jobs" on public.cart_jobs;
create policy "select own jobs" on public.cart_jobs
  for select using (household_id = public.mon_foyer());

drop policy if exists "insert own jobs" on public.cart_jobs;
create policy "insert own jobs" on public.cart_jobs
  for insert with check (household_id = public.mon_foyer());

drop policy if exists "advance own jobs" on public.cart_jobs;
create policy "advance own jobs" on public.cart_jobs
  for update
  using (household_id = public.mon_foyer())
  with check (
    household_id = public.mon_foyer()
    and status in ('claimed', 'running', 'needs_action', 'done', 'failed')
  );

drop policy if exists "cancel own pending jobs" on public.cart_jobs;
create policy "cancel own pending jobs" on public.cart_jobs
  for update
  using (household_id = public.mon_foyer() and status = 'pending')
  with check (status = 'cancelled');

-- Les deux tables nouvelles se protègent elles-mêmes.
alter table public.households enable row level security;
alter table public.household_members enable row level security;

drop policy if exists "voir son foyer" on public.households;
create policy "voir son foyer" on public.households
  for select using (id = public.mon_foyer());

drop policy if exists "renommer son foyer" on public.households;
create policy "renommer son foyer" on public.households
  for update using (id = public.mon_foyer()) with check (id = public.mon_foyer());

drop policy if exists "voir les membres" on public.household_members;
create policy "voir les membres" on public.household_members
  for select using (household_id = public.mon_foyer());

-- Le retrait d'un membre est réservé au créateur, et ne peut viser ni
-- lui-même ni un autre créateur : un foyer sans créateur deviendrait un foyer
-- dont personne ne peut plus gérer les accès.
drop policy if exists "retirer un membre" on public.household_members;
create policy "retirer un membre" on public.household_members
  for delete using (
    household_id = public.mon_foyer()
    and role <> 'createur'
    and exists (
      select 1 from public.household_members moi
      where moi.household_id = household_members.household_id
        and moi.user_id = (select auth.uid())
        and moi.role = 'createur'
    )
  );
```

- [x] **Étape 3 : appliquer**

Par l'outil MCP Supabase `apply_migration`, nom `foyer`.

- [x] **Étape 4 : vérifier la structure**

```sql
select
  (select count(*) from public.households) as foyers,
  (select count(*) from public.household_members) as membres,
  (select count(*) from public.products where household_id is null) as produits_orphelins,
  (select count(*) from public.cart_jobs where household_id is null) as travaux_orphelins;
```

Attendu : `1` foyer, `1` membre, **zéro orphelin des deux côtés**. Un seul
orphelin signifierait que la colonne obligatoire a été posée sur des lignes non
rattachées — impossible ici, la migration aurait échoué, mais le vérifier coûte
une seconde.

- [x] **Étape 5 : vérifier que les politiques ont bien basculé**

```sql
select tablename, policyname, qual from pg_policies
where schemaname = 'public' and qual like '%mon_foyer%'
order by tablename;
```

Attendu : au moins onze politiques citant `mon_foyer()` — sept tables au régime
unique, quatre sur `cart_jobs`, plus celles des deux tables nouvelles.

Vérifier aussi qu'aucune politique ne cite encore `auth.uid() = user_id` sur les
tables de données :

```sql
select tablename, policyname from pg_policies
where schemaname = 'public' and qual like '%= user_id%';
```

Attendu : aucune ligne.

- [x] **Étape 6 : commit**

```bash
git add supabase/migrations/0010_foyer.sql
git commit -m "feat: les données appartiennent au foyer, plus à la personne"
```

---

### Tâche 2 : éprouver l'isolation

**Fichiers :**
- Créer : `supabase/tests/isolation_foyer.sql`

**Interfaces :**
- Consomme : le schéma de la tâche 1.
- Produit : un script SQL qui échoue bruyamment si l'isolation ne tient pas.

- [x] **Étape 1 : écrire le script**

Créer `supabase/tests/isolation_foyer.sql` :

```sql
-- Éprouve que deux foyers ne se voient pas.
--
-- Une politique RLS qu'on n'a pas essayée est une politique qu'on croit avoir.
-- Ce script crée un second foyer, s'y fait passer, et vérifie qu'il ne voit
-- rien du premier — puis nettoie tout derrière lui.

do $$
declare
  foyer_b uuid;
  intrus uuid := '00000000-0000-0000-0000-0000000000b2';
  vus int;
begin
  insert into public.households (name) values ('Foyer d''essai') returning id into foyer_b;
  insert into auth.users (id, email, instance_id, aud, role)
  values (intrus, 'essai-isolation@example.invalid',
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.household_members (household_id, user_id, role, joined_at)
  values (foyer_b, intrus, 'createur', now());

  -- On se fait passer pour l'intrus.
  perform set_config('request.jwt.claims',
    json_build_object('sub', intrus::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into vus from public.products;
  if vus <> 0 then
    raise exception 'ISOLATION ROMPUE : un autre foyer voit % produits', vus;
  end if;

  select count(*) into vus from public.recipes;
  if vus <> 0 then
    raise exception 'ISOLATION ROMPUE : un autre foyer voit % recettes', vus;
  end if;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  delete from public.household_members where user_id = intrus;
  delete from public.households where id = foyer_b;
  delete from auth.users where id = intrus;

  raise notice 'ISOLATION VERIFIEE : le second foyer ne voit rien du premier.';
end $$;
```

- [x] **Étape 2 : l'exécuter**

Par l'outil MCP Supabase `execute_sql`, avec le contenu du script.

Attendu : le message `ISOLATION VERIFIEE`. Une exception `ISOLATION ROMPUE`
signifie que la bascule est incomplète — **ne pas poursuivre**, revenir à la
tâche 1.

- [x] **Étape 3 : vérifier que le ménage a bien été fait**

```sql
select count(*) as restes from auth.users where email like '%example.invalid';
select count(*) as foyers from public.households;
```

Attendu : `0` reste, `1` foyer. Le script nettoie derrière lui, mais une
exception au milieu l'aurait interrompu avant : il faut le constater.

- [x] **Étape 4 : commit**

```bash
git add supabase/tests/isolation_foyer.sql
git commit -m "test: éprouve que deux foyers ne se voient pas"
```

---

### Tâche 3 : inviter par courriel

**Fichiers :**
- Créer : `supabase/functions/inviter/index.ts`
- Créer : `supabase/migrations/0011_rattachement_invite.sql`

**Interfaces :**
- Produit : une fonction Edge `inviter`, appelée par
  `supabase.functions.invoke('inviter', { body: { email } })`, rendant
  `{ ok: true }` ou `{ ok: false, erreur: string }`.

- [x] **Étape 1 : le déclencheur de rattachement**

Créer `supabase/migrations/0011_rattachement_invite.sql` :

```sql
-- Rattache un invité à son foyer dès la création de son compte.
--
-- `inviteUserByEmail` crée la ligne dans auth.users immédiatement, avant même
-- que la personne ait ouvert son lien : elle apparaît donc « en attente » dans
-- la liste des membres, ce qui est exactement ce qu'on veut montrer.

create or replace function public.rattacher_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare f uuid;
begin
  f := (new.raw_user_meta_data ->> 'household_id')::uuid;
  if f is null then
    return new;
  end if;
  insert into public.household_members (household_id, user_id, role)
  values (f, new.id, 'membre')
  on conflict (household_id, user_id) do nothing;
  return new;
end $$;

drop trigger if exists rattacher_invite_apres_creation on auth.users;
create trigger rattacher_invite_apres_creation
  after insert on auth.users
  for each row execute function public.rattacher_invite();
```

Appliquer par `apply_migration`, nom `rattachement_invite`.

- [x] **Étape 2 : la fonction Edge**

Créer `supabase/functions/inviter/index.ts` :

```ts
/**
 * Invite une personne dans le foyer de l'appelant.
 *
 * La clé de service n'est écrite nulle part : Supabase l'injecte dans
 * l'environnement de la fonction sous `SUPABASE_SERVICE_ROLE_KEY`. Elle ne doit
 * ni être commitée, ni transiter par le téléphone.
 *
 * L'appelant est identifié par son propre jeton, avec la clé publiable : c'est
 * ce qui garantit qu'il ne peut inviter que dans son foyer à lui.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const CLE_PUBLIABLE = Deno.env.get('SUPABASE_ANON_KEY')!;
const CLE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const reponse = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reponse({ ok: false, erreur: 'Méthode refusée.' }, 405);

  const autorisation = req.headers.get('Authorization') ?? '';
  if (!autorisation) return reponse({ ok: false, erreur: 'Session absente.' }, 401);

  let email = '';
  try {
    email = String((await req.json())?.email ?? '').trim().toLowerCase();
  } catch {
    return reponse({ ok: false, erreur: 'Requête illisible.' }, 400);
  }
  if (!email.includes('@')) return reponse({ ok: false, erreur: 'Adresse invalide.' }, 400);

  // Client de l'appelant : RLS s'applique, donc `mon_foyer()` rend le sien.
  const appelant = createClient(URL_SB, CLE_PUBLIABLE, {
    global: { headers: { Authorization: autorisation } },
  });
  const { data: foyer, error: erreurFoyer } = await appelant.rpc('mon_foyer');
  if (erreurFoyer || !foyer) {
    return reponse({ ok: false, erreur: "Tu n'appartiens à aucun foyer." }, 403);
  }

  const admin = createClient(URL_SB, CLE_SERVICE);
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { household_id: foyer },
    redirectTo: 'coursesapp://reinitialisation',
  });

  if (error) {
    console.error('[inviter]', error.message);
    // Message français, jamais la réponse brute : « User already registered »
    // ou une limite d'envoi ne veulent rien dire pour qui invite sa famille.
    const dejaInscrit = error.message.toLowerCase().includes('already');
    return reponse({
      ok: false,
      erreur: dejaInscrit
        ? 'Cette adresse a déjà un compte.'
        : "L'invitation n'a pas pu être envoyée. Réessaie dans quelques minutes.",
    }, 400);
  }

  return reponse({ ok: true });
});
```

- [x] **Étape 3 : déployer**

Par l'outil MCP Supabase `deploy_edge_function`, projet `qmymwicsgilhoihtfdjm`,
nom `inviter`, avec le contenu ci-dessus.

- [x] **Étape 4 : vérifier le déploiement**

Par l'outil MCP `list_edge_functions`. Attendu : `inviter` apparaît.

**Ne pas éprouver l'envoi réel ici** : le service de courriel intégré est bridé
à quelques envois par heure, et il faut garder ce crédit pour l'essai sur
l'appareil, à la tâche 6.

- [x] **Étape 5 : commit**

```bash
git add supabase/functions/inviter supabase/migrations/0011_rattachement_invite.sql
git commit -m "feat: invitation d'un membre par courriel"
```

---

### Tâche 4 : le foyer côté application

**Fichiers :**
- Créer : `mobile/lib/foyer-libelles.ts`
- Créer : `mobile/lib/foyer-libelles.test.mjs`
- Créer : `mobile/stores/foyer.ts`

**Interfaces :**
- Produit :
  - `libelleMembre(m: { role: string; joined_at: string | null }): string`
  - `peutRetirer(moi: { role: string; user_id: string }, cible: { role: string; user_id: string }): boolean`
  - `type Membre = { id: string; user_id: string; role: string; joined_at: string | null; email: string | null }`
  - `useFoyer(): { foyer: { id: string; name: string } | null; membres: Membre[]; moi: Membre | null; chargement: boolean; erreur: string | null; recharger: () => Promise<void> }`
  - `inviter(email: string): Promise<{ ok: boolean; erreur?: string }>`
  - `retirerMembre(id: string): Promise<{ ok: boolean; erreur?: string }>`
  - `renommerFoyer(nom: string): Promise<{ ok: boolean; erreur?: string }>`

- [x] **Étape 1 : écrire le test qui échoue**

Créer `mobile/lib/foyer-libelles.test.mjs` :

```js
/**
 * Libellés et garde-fous du foyer. Fonctions pures, sans réseau.
 * Lancer : node --test mobile/lib/foyer-libelles.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { libelleMembre, peutRetirer } from './foyer-libelles.ts';

test('le créateur est signalé comme tel', () => {
  assert.match(libelleMembre({ role: 'createur', joined_at: '2026-08-22' }), /cr[ée]/i);
});

test("un membre qui n'a pas ouvert son lien est en attente", () => {
  assert.match(libelleMembre({ role: 'membre', joined_at: null }), /attente/i);
});

test('un membre actif est simplement membre', () => {
  assert.equal(libelleMembre({ role: 'membre', joined_at: '2026-08-22' }), 'Membre');
});

test('aucun libellé ne laisse fuir un code technique', () => {
  for (const m of [
    { role: 'createur', joined_at: null },
    { role: 'membre', joined_at: null },
    { role: 'membre', joined_at: '2026-08-22' },
  ]) {
    const t = libelleMembre(m);
    assert.ok(!t.includes(m.role), `le rôle fuit : ${t}`);
  }
});

test('le créateur peut retirer un membre ordinaire', () => {
  assert.equal(
    peutRetirer({ role: 'createur', user_id: 'a' }, { role: 'membre', user_id: 'b' }),
    true,
  );
});

test('personne ne peut se retirer soi-même', () => {
  // Un foyer sans membre serait un foyer dont les données deviennent
  // inaccessibles à tous.
  assert.equal(
    peutRetirer({ role: 'createur', user_id: 'a' }, { role: 'createur', user_id: 'a' }),
    false,
  );
});

test('un membre ordinaire ne retire personne', () => {
  assert.equal(
    peutRetirer({ role: 'membre', user_id: 'b' }, { role: 'membre', user_id: 'c' }),
    false,
  );
});

test('le créateur ne peut pas être retiré', () => {
  assert.equal(
    peutRetirer({ role: 'createur', user_id: 'a' }, { role: 'createur', user_id: 'z' }),
    false,
  );
});
```

- [x] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/foyer-libelles.test.mjs
```

Attendu : ÉCHEC, `ERR_MODULE_NOT_FOUND` sur `./foyer-libelles.ts`.

- [x] **Étape 3 : écrire les libellés**

Créer `mobile/lib/foyer-libelles.ts` :

```ts
/** Libellés et garde-fous du foyer. Aucun code technique n'atteint l'écran. */

export function libelleMembre(m: { role: string; joined_at: string | null }): string {
  if (m.role === 'createur') return 'A créé le foyer';
  return m.joined_at ? 'Membre' : 'Invité, en attente';
}

/**
 * Dit si `moi` peut retirer `cible`.
 *
 * On ne peut retirer ni soi-même, ni un créateur : un foyer sans créateur
 * serait un foyer dont personne ne peut plus gérer les accès, et un foyer sans
 * membre un foyer dont les données deviennent inaccessibles à tous.
 *
 * La même règle est écrite dans la politique RLS : celle-ci fait foi, celle-là
 * évite de proposer un geste qui sera refusé.
 */
export function peutRetirer(
  moi: { role: string; user_id: string },
  cible: { role: string; user_id: string },
): boolean {
  if (moi.role !== 'createur') return false;
  if (moi.user_id === cible.user_id) return false;
  if (cible.role === 'createur') return false;
  return true;
}
```

- [x] **Étape 4 : écrire le magasin**

Créer `mobile/stores/foyer.ts`, sur le patron de `stores/recipes.ts` — hook
maison, compteur de génération, message français en cas d'échec.

`useFoyer` lit `households` et `household_members`. **L'adresse des membres ne
vient pas de `auth.users`**, que RLS n'expose pas : elle est lue par la vue
`public.membres_du_foyer`, créée en tâche 5.

`inviter(email)` appelle `supabase.functions.invoke('inviter', { body: { email } })`
et rend le champ `erreur` de la réponse tel quel — il est déjà en français.

`retirerMembre(id)` supprime la ligne de `household_members`. Si RLS refuse, la
suppression rend zéro ligne sans erreur : il faut donc demander le compte par
`.select()` et traiter zéro comme un refus, avec le message « Tu ne peux pas
retirer ce membre. »

`renommerFoyer(nom)` met à jour `households.name`, refusant un nom vide.

- [x] **Étape 5 : lancer les tests et vérifier qu'ils passent**

```bash
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
npx tsc --noEmit
```

Attendu : `# fail 0`, aucune erreur TypeScript.

- [x] **Étape 6 : commit**

```bash
git add mobile/lib/foyer-libelles.ts mobile/lib/foyer-libelles.test.mjs mobile/stores/foyer.ts
git commit -m "feat: lecture et gestion du foyer côté application"
```

---

### Tâche 5 : l'écran Compte

**Fichiers :**
- Créer : `supabase/migrations/0012_vue_membres.sql`
- Modifier : `mobile/app/(tabs)/compte.tsx`

**Interfaces :**
- Consomme : `useFoyer`, `inviter`, `retirerMembre`, `renommerFoyer` ;
  `libelleMembre`, `peutRetirer`.

- [x] **Étape 1 : la vue des membres**

`auth.users` n'est pas lisible par RLS : sans vue, la liste des membres
n'afficherait que des identifiants.

Créer `supabase/migrations/0012_vue_membres.sql` :

```sql
-- Adresse des membres du foyer.
--
-- auth.users n'est pas exposée aux clients : sans cette vue, la liste des
-- membres n'afficherait que des UUID. La vue ne rend que les membres du foyer
-- de l'appelant, et rien d'autre de auth.users — ni mot de passe, ni jetons.

create or replace view public.membres_du_foyer
with (security_invoker = true) as
select
  m.id,
  m.household_id,
  m.user_id,
  m.role,
  m.invited_at,
  m.joined_at,
  u.email
from public.household_members m
join auth.users u on u.id = m.user_id
where m.household_id = public.mon_foyer();

grant select on public.membres_du_foyer to authenticated;
```

Appliquer par `apply_migration`, nom `vue_membres`.

Vérifier ensuite :

```sql
select user_id, role, email, joined_at from public.membres_du_foyer;
```

Attendu : une ligne, avec l'adresse en clair et le rôle `createur`.

- [x] **Étape 2 : réécrire l'écran**

`mobile/app/(tabs)/compte.tsx` porte :

- **Le foyer** — son nom, modifiable par un champ, enregistré à la sortie du
  champ. Un nom vide est refusé avec « Donne un nom à ton foyer. »
- **Les membres** — pour chacun : l'adresse, `libelleMembre(m)` en dessous, et
  un bouton **Retirer** affiché seulement si `peutRetirer(moi, m)`. Le retrait
  demande confirmation par `Alert.alert` : titre « Retirer ce membre ? », corps
  « Il perdra l'accès au foyer. Le catalogue et les recettes restent. »
- **Inviter** — un champ d'adresse et un bouton. Pendant l'appel, un
  `ActivityIndicator`. En cas de succès : « Invitation envoyée. » En cas
  d'échec, le message rendu par la fonction, tel quel.
- **Se déconnecter** — le bouton existant, inchangé.

États : chargement, erreur avec « Réessayer ».

- [x] **Étape 3 : vérifier**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
```

Attendu : aucune erreur, `# fail 0`.

- [x] **Étape 4 : commit**

```bash
git add supabase/migrations/0012_vue_membres.sql "mobile/app/(tabs)/compte.tsx"
git commit -m "feat: écran Compte avec foyer, membres et invitation"
```

---

### Tâche 6 : livrer

- [x] **Étape 1 : vérification complète**

```bash
npx tsc --noEmit
/Users/angel-assistant/.nvm/versions/node/v22.23.2/bin/node --test lib/*.test.mjs
npx expo-doctor
EXPO_PUBLIC_SUPABASE_URL="https://qmymwicsgilhoihtfdjm.supabase.co" \
EXPO_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_PueJWmalqhZO0ctPu95GKQ_EaAgVulr" \
npx expo export --platform ios --output-dir /tmp/export-foyer
```

Attendu : aucune erreur TypeScript, `# fail 0`, expo-doctor sans échec autre que
les deux connus, et `Exported:`.

- [x] **Étape 2 : vérifier que l'application lit toujours ses données**

La bascule RLS est le risque de ce lot : si `mon_foyer()` ne rendait rien,
l'application afficherait un catalogue vide sans erreur.

```sql
select count(*) from public.products;
```

Exécuté par l'outil MCP — donc sans RLS — attendu : `68`. Puis, après
installation, vérifier sur l'appareil que le catalogue en affiche bien 68 : c'est
le seul contrôle qui traverse réellement RLS.

- [x] **Étape 3 : pousser**

```bash
git push origin mobile/expo-scan
```

- [x] **Étape 4 : suivre le build**

Avec `asc.mjs`, en **triant explicitement** : l'API ne rend pas les exécutions de
la plus récente à la plus ancienne, et `limit=1` renvoie la première, pas la
dernière.

```bash
ASC_KEY_ID=AYC86383MB \
ASC_ISSUER_ID=a725aaeb-78b3-44bb-80ee-018ca724ba5f \
ASC_KEY_PATH="$HOME/.appstoreconnect/AuthKey_AYC86383MB.p8" \
node asc.mjs "/v1/ciProducts/4ece9928-69b5-4a0a-a0cc-bdd408d09a57/buildRuns?limit=10"
```

- [ ] **Étape 5 : éprouver sur l'appareil**

**Dans cet ordre**, le premier point conditionnant le second :

1. **Le lien profond.** Demander une réinitialisation de mot de passe et vérifier
   que le lien ouvre l'application. **Ce chemin n'a jamais été éprouvé**, et
   l'invitation emprunte exactement le même. S'il échoue, l'invitation échouera.
2. Le catalogue affiche 68 produits, les recettes 5 : la bascule RLS n'a rien
   masqué.
3. L'écran Compte montre le foyer et un membre, marqué « A créé le foyer ».
4. Renommer le foyer, quitter l'écran, y revenir : le nom a tenu.
5. Inviter une seconde adresse. Elle apparaît « Invité, en attente ».
6. Ouvrir le courriel reçu sur un autre appareil, poser un mot de passe, et
   vérifier que le catalogue partagé s'affiche — et que la ligne passe
   « Membre ».
7. Retirer ce membre : il disparaît, et le catalogue reste intact.

## Ce que ce plan ne fait pas

- La copie des données au départ d'un membre.
- Plusieurs foyers par personne.
- Des rôles plus fins que créateur et membre.
- L'inscription libre.
