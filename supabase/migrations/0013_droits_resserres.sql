-- Resserre les droits que les privilèges par défaut du schéma public ont
-- accordés d'office.
--
-- Constat du 22/08/2026, après audit : `anon` disposait de SELECT, INSERT,
-- UPDATE, DELETE et TRUNCATE sur `membres_du_foyer`. Non pas à cause de la
-- migration 0012 — dont le `grant select ... to authenticated` était en
-- réalité décoratif — mais parce que Supabase accorde par défaut ces droits à
-- `anon` et `authenticated` sur tout nouvel objet du schéma public.
--
-- Les écritures étaient inertes : la vue porte un `join`, donc Postgres la
-- déclare non modifiable (`is_updatable = NO`). Restait le SELECT.
--
-- Ce SELECT ne fuyait rien — vérifié : un appel anonyme rend `[]`, parce que
-- `mon_foyer()` rend NULL sans `auth.uid()`. Mais c'est le seul objet du
-- schéma sans filet : une vue n'a pas de RLS, et celle-ci tourne avec les
-- droits de son propriétaire pour pouvoir lire auth.users. Sa sûreté tient
-- donc tout entière à sa clause `where`. Une modification distraite qui la
-- retirerait exposerait l'adresse de tous les comptes, sans que rien ne
-- s'y oppose.

revoke all on public.membres_du_foyer from anon;
revoke all on public.membres_du_foyer from authenticated;
grant select on public.membres_du_foyer to authenticated;

-- `mon_foyer()` appelée sans session rend NULL : inutile de laisser
-- /rest/v1/rpc/mon_foyer ouverte aux visiteurs.
--
-- Révoquer nommément à `anon` ne suffisait pas : la première entrée de l'ACL,
-- `=X/postgres`, accorde l'exécution à PUBLIC, dont `anon` est membre. C'est
-- le retrait à PUBLIC qui ferme réellement la porte.
--
-- Conséquence à connaître : les politiques RLS de huit tables appellent cette
-- fonction. Sans le droit de l'exécuter, une requête anonyme ne rend plus une
-- liste vide mais une erreur 42501. L'isolation est la même ; le chemin
-- d'erreur, lui, change.
revoke execute on function public.mon_foyer() from public;
grant execute on function public.mon_foyer() to authenticated, service_role;

-- `rattacher_invite()` garde ses droits, délibérément. PostgREST n'expose pas
-- les fonctions qui rendent un `trigger` — mesuré : un appel anonyme répond
-- PGRST202, « could not find the function ». La surface RPC que signale
-- l'analyseur n'existe pas, et le déclencheur d'invitation n'a encore jamais
-- été éprouvé sur un appareil : y toucher maintenant rendrait son premier
-- essai réel plus difficile à diagnostiquer.

-- Déclencheur d'intégrité : il n'est pas `security definer`, mais un
-- `search_path` libre laisserait un appelant lui substituer sa propre table
-- `cart_jobs` et contourner ainsi l'immuabilité du contenu d'un travail.
alter function public.cart_job_contenu_intact() set search_path = public;
