-- Fixtures transactionnelles : aucun compte ni aucune adresse ne subsiste.
begin;
do $$
declare
  f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid();
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  intrus uuid := gen_random_uuid();
  n integer; adresse text; obtenu uuid; refus boolean := false;
  membre record; attendus integer; visibles integer;
begin
  if has_table_privilege('authenticated', 'auth.users', 'select') then
    raise exception 'auth.users est lisible';
  end if;
  if exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.prosecdef and (has_function_privilege('anon', p.oid, 'execute')
      or has_function_privilege('authenticated', p.oid, 'execute'))) then
    raise exception 'Fonction publique privilégiée encore exécutable';
  end if;

  -- Les membres réels conservent leur accès et leurs adresses, sans les afficher.
  for membre in select user_id, household_id from public.household_members loop
    select count(*) into attendus from public.household_members where household_id = membre.household_id;
    perform set_config('request.jwt.claims', json_build_object('sub', membre.user_id, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into visibles from public.membres_du_foyer;
    select public.mon_foyer() into obtenu;
    perform set_config('role', 'postgres', true);
    if visibles <> attendus or obtenu is distinct from membre.household_id then
      raise exception 'Accès existant cassé';
    end if;
  end loop;

  insert into public.households(id) values (f1), (f2);
  insert into auth.users(id, email, raw_user_meta_data)
  values (u1, u1::text || '@example.invalid', '{}'::jsonb),
         (u2, u2::text || '@example.invalid', '{}'::jsonb),
         (intrus, intrus::text || '@example.invalid', jsonb_build_object('household_id', f1));
  if exists (select 1 from public.household_members where user_id = intrus) then
    raise exception 'Les métadonnées utilisateur permettent encore de rejoindre un foyer';
  end if;
  insert into public.household_members(household_id, user_id, role)
  values (f1, u1, 'createur'), (f2, u2, 'createur');
  update auth.users set email = u1::text || '-nouveau@example.invalid' where id = u1;

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*), max(email) into n, adresse from public.membres_du_foyer;
  if n <> 1 or adresse is distinct from u1::text || '-nouveau@example.invalid' then
    raise exception 'Isolation ou synchronisation email cassée';
  end if;
  begin
    insert into public.household_members(household_id, user_id) values (f2, u1);
  exception when insufficient_privilege then refus := true;
  end;
  if not refus then raise exception 'Un client peut se rattacher à un autre foyer'; end if;
  perform set_config('role', 'postgres', true);

  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*), max(email) into n, adresse from public.membres_du_foyer;
  if n <> 1 or adresse is distinct from u2::text || '@example.invalid' then
    raise exception 'Isolation du second foyer cassée';
  end if;
  perform set_config('role', 'postgres', true);

  perform set_config('request.jwt.claims', json_build_object('sub', intrus, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.membres_du_foyer;
  if n <> 0 then raise exception 'Un non-membre voit des adresses'; end if;
  perform set_config('role', 'postgres', true);

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  select public.mon_foyer() into obtenu;
  if obtenu is not null then raise exception 'Un anonyme obtient un foyer'; end if;
  select count(*) into n from public.products;
  if n <> 0 then raise exception 'Un anonyme voit des produits'; end if;
  select count(*) into n from public.household_members;
  if n <> 0 then raise exception 'Un anonyme voit des membres'; end if;
  refus := false;
  begin
    perform * from public.membres_du_foyer;
  exception when insufficient_privilege then refus := true;
  end;
  if not refus then raise exception 'La vue accepte encore anon'; end if;
  perform set_config('role', 'postgres', true);
end $$;
rollback;
select 'Isolation, accès existants, emails, inscription forgée et droits : OK' as verification;
