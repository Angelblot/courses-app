-- Nombre de personnes à table, réglé une fois pour tout le foyer.
--
-- Un repas choisi pendant la session prend ce nombre de portions : les
-- quantités de la liste sont justes sans rien régler recette par recette.
-- NULL tant que le foyer ne l'a pas indiqué : on garde alors le nombre de
-- portions de la recette, comme avant.
--
-- La politique « renommer son foyer » (0010) couvre déjà la mise à jour :
-- chaque membre modifie la ligne de son propre foyer, et d'aucun autre.

alter table public.households
  add column if not exists personnes smallint
  check (personnes between 1 and 20);
