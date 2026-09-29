-- Image d'un produit noté à la main, trouvée ou générée une fois pour toutes.
--
-- La fonction `image-produit` cherche d'abord une vraie photo sur Open Food
-- Facts, sinon génère une illustration, puis retient l'adresse ici sous le
-- nom normalisé (voir mobile/lib/image-produit.ts). Un même nom n'est plus
-- jamais cherché ni généré.
--
-- Seule la fonction lit et écrit cette table (clé de service) : un foyer ne
-- peut pas y lire les noms que les autres foyers ont notés.

create table if not exists public.images_produits (
  cle text primary key,
  url text not null,
  source text not null check (source in ('off', 'generee')),
  created_at timestamptz not null default now()
);

alter table public.images_produits enable row level security;
revoke all on public.images_produits from anon, authenticated;

-- Les illustrations générées, en lecture publique : l'application les
-- affiche par leur adresse, sans jeton.
insert into storage.buckets (id, name, public)
values ('images-produits', 'images-produits', true)
on conflict (id) do nothing;
