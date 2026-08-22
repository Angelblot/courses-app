-- Bucket des photos de recettes.
--
-- Une photo prise sur le téléphone donne une adresse `file://` locale : elle
-- ne survivrait ni à une réinstallation, ni au partage du foyer prévu plus
-- tard. Elle doit donc être déposée.
--
-- Le bucket est public en lecture : `products.image_url` porte déjà des
-- adresses publiques (Open Food Facts), et l'application les affiche par un
-- simple <Image>. Des adresses signées imposeraient de les renouveler à chaque
-- affichage, pour des photos de gratin.
--
-- L'écriture, elle, reste réservée au propriétaire : le premier segment du
-- chemin est son identifiant.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recettes', 'recettes', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "lecture publique des photos" on storage.objects;
create policy "lecture publique des photos" on storage.objects
  for select using (bucket_id = 'recettes');

drop policy if exists "depot par le proprietaire" on storage.objects;
create policy "depot par le proprietaire" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'recettes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "suppression par le proprietaire" on storage.objects;
create policy "suppression par le proprietaire" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'recettes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
