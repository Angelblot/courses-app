-- Pièces par conditionnement : une boîte de 6 œufs, un régime de 5 bananes.
-- Sans elle, une recette qui demande 6 œufs faisait acheter 6 boîtes.
-- Nulle : l'application lit alors le nombre dans le nom (« x6 », « boîte de 12 »).
alter table public.products
  add column if not exists nombre_unites smallint
  constraint products_nombre_unites_valide check (nombre_unites is null or nombre_unites between 2 and 500);
