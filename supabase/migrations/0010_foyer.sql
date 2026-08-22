-- Les données passent d'une propriété individuelle à une propriété de foyer.
--
-- La conception du 18/08 avait écrit les politiques d'une seule façon —
-- `(select auth.uid()) = user_id`, identique sur sept tables — précisément pour
-- que ce jour-là ne coûte pas cher. C'est ce qui se vérifie ici.
--
-- État d'origine, relevé avant application :
--   cart_jobs           insert own jobs / select own jobs
--                       advance own jobs / cancel own pending jobs
--   categories          owner all
--   category_aliases    owner all
--   product_equivalents owner all
--   products            owner all
--   purchase_lines      owner all
--   recipe_ingredients  owner all
--   recipes             owner all
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
  -- apparaît alors « en attente » dans la liste des membres.
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
