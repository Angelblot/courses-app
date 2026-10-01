-- Champs d'un produit corrigés à la main depuis sa fiche (« name », « brand »,
-- « contenance », « category », « nutriscore », « image_url »).
--
-- Une actualisation depuis Open Food Facts montre ces champs mais ne les
-- coche pas : elle ne défait jamais silencieusement une correction du foyer.
-- La politique « foyer all » couvre déjà la colonne.

alter table public.products
  add column if not exists champs_manuels text[] not null default '{}';
