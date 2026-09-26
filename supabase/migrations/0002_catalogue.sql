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
