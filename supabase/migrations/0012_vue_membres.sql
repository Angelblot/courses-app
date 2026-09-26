-- Adresse des membres du foyer.
--
-- auth.users n'est pas exposée aux clients : sans cette vue, la liste des
-- membres n'afficherait que des UUID.
--
-- La vue tourne avec les droits de son propriétaire — `security_invoker` reste
-- à faux — parce que `authenticated` n'a aucun accès à auth.users, et qu'on ne
-- veut surtout pas lui en donner : ce serait exposer les empreintes de mots de
-- passe et les jetons de rafraîchissement de tout le monde. Une première
-- version en `security_invoker = true` échouait d'ailleurs par « permission
-- denied for table users ».
--
-- L'isolation est alors portée par la clause `where` de la vue elle-même :
-- `mon_foyer()` lit `auth.uid()` de la requête en cours, donc chacun ne voit
-- que les membres de son propre foyer. Éprouvé dans les deux sens.

drop view if exists public.membres_du_foyer;

create view public.membres_du_foyer as
select
  m.id,
  m.household_id,
  m.user_id,
  m.role,
  m.invited_at,
  m.joined_at,
  u.email
from public.household_members m
join auth.users u on u.id = m.user_id
where m.household_id = public.mon_foyer();

grant select on public.membres_du_foyer to authenticated;
