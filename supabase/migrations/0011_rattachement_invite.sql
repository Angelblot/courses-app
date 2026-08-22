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
exception when others then
  -- Un rattachement qui échoue ne doit pas empêcher la création du compte :
  -- la personne pourra être réinvitée, alors qu'un compte à moitié créé
  -- serait un état dont on ne sort pas.
  raise warning 'rattacher_invite a échoué pour % : %', new.id, sqlerrm;
  return new;
end $$;

drop trigger if exists rattacher_invite_apres_creation on auth.users;
create trigger rattacher_invite_apres_creation
  after insert on auth.users
  for each row execute function public.rattacher_invite();
