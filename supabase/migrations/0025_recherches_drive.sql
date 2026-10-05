-- Recherches demandées depuis l'app (« Chercher sur Carrefour et E.Leclerc »)
-- pour un produit introuvable dans les bases ouvertes. L'extension les fait
-- dans le Chrome de l'utilisateur, à rythme humain, quand il les lance ; les
-- résultats arrivent dans offres_drive, rattachés à leur recherche.
create table public.recherches_drive (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.mon_foyer() references public.households (id) on delete cascade,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  drive text not null check (drive in ('carrefour', 'leclerc')),
  -- Ce qui est cherché : le nom du manque, ou un code-barres scanné.
  requete text not null check (char_length(requete) between 1 and 200),
  ean13 text check (ean13 ~ '^\d{8,14}$'),
  -- en_attente → en_cours → faite | vide ; verification : le drive a demandé
  -- un geste humain, la recherche reprendra au prochain lancement.
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'en_cours', 'faite', 'vide', 'verification', 'echec')),
  resultats integer,
  demandee_le timestamptz not null default now(),
  faite_le timestamptz
);

create index recherches_drive_attente_idx on public.recherches_drive (household_id, statut, demandee_le);
create index recherches_drive_requete_idx on public.recherches_drive (household_id, lower(requete), drive, demandee_le desc);

alter table public.recherches_drive enable row level security;
create policy "foyer all" on public.recherches_drive for all
  using (household_id = public.mon_foyer())
  with check (household_id = public.mon_foyer());

-- Les offres d'une recherche demandée ; null pour celles d'un remplissage.
alter table public.offres_drive
  add column if not exists recherche_id uuid references public.recherches_drive (id) on delete cascade;
create index if not exists offres_drive_recherche_id_idx on public.offres_drive (recherche_id) where recherche_id is not null;

-- L'app suit l'avancement en temps réel, comme pour cart_jobs.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'recherches_drive') then
    alter publication supabase_realtime add table public.recherches_drive;
  end if;
end $$;
