-- Offres relevées par l'extension sur les drives : chaque recherche montre
-- jusqu'à une vingtaine de produits, avec leur prix, leur prix au kilo ou au
-- litre, leur contenance et parfois leur Nutri-Score. On les garde pour
-- comparer les alternatives et proposer des produits plus pertinents.
create table public.offres_drive (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.mon_foyer() references public.households (id) on delete cascade,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  drive text not null check (drive in ('carrefour', 'leclerc')),
  -- Le produit de la liste qui a déclenché la recherche, et ce qui a été cherché.
  product_id uuid references public.products (id) on delete set null,
  recherche text not null,
  cart_job_id uuid references public.cart_jobs (id) on delete set null,
  libelle text not null,
  marque text,
  ean13 text,
  url text,
  image_url text,
  prix numeric(8, 2),
  prix_unitaire numeric(9, 2),
  unite_prix text check (unite_prix in ('kg', 'l', 'unite')),
  grammage_g numeric(9, 1),
  volume_ml numeric(9, 1),
  nombre integer,
  nutriscore text check (nutriscore in ('a', 'b', 'c', 'd', 'e')),
  promotion text,
  disponible boolean not null default true,
  -- Rang dans les résultats, et le produit que l'extension a mis au panier.
  rang integer,
  choisi boolean not null default false,
  vu_le timestamptz not null default now()
);

create index offres_drive_recherche_idx on public.offres_drive (household_id, product_id, drive, vu_le desc);
create index offres_drive_ean_idx on public.offres_drive (household_id, ean13) where ean13 is not null;

alter table public.offres_drive enable row level security;
create policy "foyer all" on public.offres_drive for all
  using (household_id = public.mon_foyer())
  with check (household_id = public.mon_foyer());
