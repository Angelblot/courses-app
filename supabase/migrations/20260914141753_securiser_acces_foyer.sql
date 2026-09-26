-- Déployer d'abord inviter : le serveur écrit l'appartenance explicitement.
-- Les signatures RPC et les colonnes de membres_du_foyer sont conservées.
create schema private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated, service_role;

create function private.mon_foyer()
returns uuid language sql stable security definer set search_path = ''
as $$
  select household_id from public.household_members
  where user_id = (select auth.uid()) limit 1;
$$;
revoke all on function private.mon_foyer() from public, anon, authenticated;
grant execute on function private.mon_foyer() to anon, authenticated, service_role;

-- Le point d'entrée public n'élève plus ses propres privilèges. La fonction
-- interne n'accepte aucun user_id : elle ne peut lire que le foyer du JWT.
create or replace function public.mon_foyer()
returns uuid language sql stable security invoker set search_path = ''
as $$ select private.mon_foyer(); $$;

-- Les adresses partagées appartiennent désormais à une table protégée par RLS.
alter table public.household_members add column email varchar(255);
update public.household_members m set email = u.email
from auth.users u where u.id = m.user_id;

create function private.adresse_membre()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  select u.email into new.email from auth.users u where u.id = new.user_id;
  return new;
end;
$$;
revoke all on function private.adresse_membre() from public, anon, authenticated;
create trigger adresse_membre_avant_ecriture
before insert or update of user_id, email on public.household_members
for each row execute function private.adresse_membre();

create function private.synchroniser_adresse_membre()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.household_members set email = new.email where user_id = new.id;
  return new;
end;
$$;
revoke all on function private.synchroniser_adresse_membre() from public, anon, authenticated;
create trigger synchroniser_adresse_membre
after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute function private.synchroniser_adresse_membre();

create or replace view public.membres_du_foyer
with (security_invoker = true) as
select m.id, m.household_id, m.user_id, m.role, m.invited_at, m.joined_at, m.email
from public.household_members m
where m.household_id = public.mon_foyer();
revoke all on public.membres_du_foyer from public, anon, authenticated;
grant select on public.membres_du_foyer to authenticated;

-- L'ancien déclencheur faisait confiance à raw_user_meta_data.household_id.
-- Seule la fonction serveur inviter, avec service_role, rattache les invités.
drop trigger rattacher_invite_apres_creation on auth.users;
drop function public.rattacher_invite();

notify pgrst, 'reload schema';
