-- Ce que fait l'extension Chrome du foyer, vu depuis l'app : une ligne par
-- foyer, réécrite chaque minute tant que Chrome est ouvert, et à chaque étape
-- d'une séance. L'app y lit si l'ordinateur est là, et ce qui avance.
create table public.extension_presence (
  household_id uuid primary key default public.mon_foyer() references public.households (id) on delete cascade,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  vue_le timestamptz not null default now(),
  -- prete : ouverte, rien en cours ; recherches / remplissage : une séance
  -- avance ; pause : vérification ou magasin à choisir, une main est attendue.
  activite text not null default 'prete' check (activite in ('prete', 'recherches', 'remplissage', 'pause')),
  -- { fait, total, drive, requete, message } selon l'activité.
  detail jsonb not null default '{}'::jsonb,
  version text
);

alter table public.extension_presence enable row level security;
create policy "foyer all" on public.extension_presence for all
  using (household_id = public.mon_foyer())
  with check (household_id = public.mon_foyer());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'extension_presence') then
    alter publication supabase_realtime add table public.extension_presence;
  end if;
end $$;
