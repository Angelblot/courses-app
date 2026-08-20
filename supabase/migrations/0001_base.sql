-- Base rétroactive.
--
-- La fonction public.set_updated_at() et la table public.cart_jobs existent
-- déjà sur le projet en ligne (migrations non versionnées "create_cart_jobs_
-- queue" et "harden_set_updated_at", appliquées directement via un outil,
-- avant que ce dépôt ne commence à suivre les migrations à partir de
-- 0002_catalogue.sql). Or 0002 crée deux déclencheurs qui appellent
-- public.set_updated_at() : sans ce fichier, rejouer les migrations sur une
-- base vierge échoue dès 0002 avec "function public.set_updated_at() does
-- not exist".
--
-- Ce fichier reconstitue fidèlement cet état, à partir d'une lecture directe
-- du schéma en ligne (pg_get_functiondef, information_schema.columns,
-- pg_constraint, pg_indexes, pg_policies, pg_trigger, pg_publication_rel) —
-- pas d'une reconstruction approximative. Il n'introduit aucune évolution :
-- c'est un rattrapage a posteriori, numéroté 0001 pour se rejouer avant
-- 0002_catalogue.sql qui en dépend.

-- 1. Fonction déclencheur générique pour les colonnes updated_at.
-- Utilisée ici par cart_jobs, et par products/recipes en 0002_catalogue.sql.
-- search_path figé à '' : durcissement contre le détournement de search_path
-- côté fonctions SQL/PL-pgSQL (recommandation Supabase "Function Search Path
-- Mutable"). C'est ce durcissement que 0003_catalogue_suivi.sql référence en
-- commentaire ("la fonction déjà durcie").
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

-- Personne côté client (rôles anon/authenticated) n'a besoin d'appeler cette
-- fonction directement : seuls les déclencheurs en ont besoin, sous l'identité
-- du rôle qui exécute la requête déclenchante. On retire donc le droit
-- d'exécution accordé par défaut à PUBLIC, et on ne le rend qu'aux rôles
-- serveur.
revoke execute on function public.set_updated_at() from public;
grant execute on function public.set_updated_at() to service_role;
grant execute on function public.set_updated_at() to postgres;

-- 2. File d'attente des générations de panier drive.
-- Le scraping Playwright (Carrefour/Leclerc) tourne côté serveur de façon
-- asynchrone : le backend dépose un job, le fait progresser (progress),
-- puis y écrit son résultat (results) ou son erreur. Le frontend suit l'état
-- par abonnement Realtime plutôt que par polling (cf. publication plus bas).
create table public.cart_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'running', 'needs_action', 'done', 'failed', 'cancelled')),
  drives text[] not null check (array_length(drives, 1) > 0),
  items jsonb not null,
  progress jsonb not null default '{}'::jsonb,
  results jsonb,
  error text,
  claimed_at timestamptz,
  finished_at timestamptz
);

-- Liste "Mes générations" côté utilisateur, plus récentes d'abord.
create index cart_jobs_user_idx on public.cart_jobs (user_id, created_at desc);
-- File de traitement côté worker : ne balaie que les jobs encore actifs.
create index cart_jobs_status_idx on public.cart_jobs (status, created_at)
  where status in ('pending', 'claimed', 'running', 'needs_action');

create trigger cart_jobs_set_updated_at
  before update on public.cart_jobs
  for each row execute function public.set_updated_at();

alter table public.cart_jobs enable row level security;

create policy "select own jobs" on public.cart_jobs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "insert own jobs" on public.cart_jobs for insert to authenticated
  with check ((select auth.uid()) = user_id);
-- Un utilisateur ne peut qu'annuler un job encore pending — jamais modifier
-- son statut vers autre chose que 'cancelled', ni toucher à un job déjà pris
-- en charge par le worker (claimed/running) : c'est ce dernier, via
-- service_role, qui fait avancer le statut au-delà de 'pending'.
create policy "cancel own pending jobs" on public.cart_jobs for update to authenticated
  using ((select auth.uid()) = user_id and status = 'pending')
  with check (status = 'cancelled');

-- Le frontend suit la progression d'un job en cours par abonnement Realtime,
-- sans polling.
alter publication supabase_realtime add table public.cart_jobs;
