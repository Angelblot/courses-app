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
