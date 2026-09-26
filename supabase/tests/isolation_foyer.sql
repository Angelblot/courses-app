-- Éprouve que l'isolation par foyer tient dans les DEUX sens.
--
-- Une politique qui cacherait tout à tout le monde passerait un test qui ne
-- vérifie que l'exclusion : il faut donc aussi constater que le propriétaire
-- voit bien ses données.
--
-- On se fait passer pour un non-membre plutôt que d'insérer un faux compte :
-- auth.users porte de nombreuses contraintes internes, et la propriété qu'on
-- veut éprouver — « qui n'est d'aucun foyer ne voit rien » — n'a pas besoin
-- d'un vrai utilisateur.

-- 1. Un non-membre ne voit rien.
do $$
declare vus int; foyer uuid;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-0000000000b2',
                      'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select public.mon_foyer() into foyer;
  if foyer is not null then
    raise exception 'ISOLATION ROMPUE : un non-membre obtient le foyer %', foyer;
  end if;

  select count(*) into vus from public.products;
  if vus <> 0 then raise exception 'ISOLATION ROMPUE : % produits visibles', vus; end if;
  select count(*) into vus from public.recipes;
  if vus <> 0 then raise exception 'ISOLATION ROMPUE : % recettes visibles', vus; end if;
  select count(*) into vus from public.cart_jobs;
  if vus <> 0 then raise exception 'ISOLATION ROMPUE : % travaux visibles', vus; end if;
  select count(*) into vus from public.household_members;
  if vus <> 0 then raise exception 'ISOLATION ROMPUE : % membres visibles', vus; end if;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
  raise notice 'ISOLATION VERIFIEE : un non-membre ne voit rien.';
end $$;

-- 2. Le propriétaire, lui, voit tout ce qui est à son foyer.
--    Adapter l'identifiant et les comptes attendus si les données changent.
do $$
declare foyer uuid; p int; r int; m int;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '1a242eef-667f-408e-8117-924bb89e1a8e',
                      'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select public.mon_foyer() into foyer;
  if foyer is null then
    raise exception 'REGRESSION : le propriétaire n''appartient à aucun foyer';
  end if;

  select count(*) into p from public.products;
  select count(*) into r from public.recipes;
  select count(*) into m from public.household_members;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  if p = 0 then raise exception 'REGRESSION : le propriétaire ne voit aucun produit'; end if;
  if r = 0 then raise exception 'REGRESSION : le propriétaire ne voit aucune recette'; end if;
  if m = 0 then raise exception 'REGRESSION : le propriétaire ne voit aucun membre'; end if;

  raise notice 'PROPRIETAIRE VERIFIE : % produits, % recettes, % membre(s).', p, r, m;
end $$;
