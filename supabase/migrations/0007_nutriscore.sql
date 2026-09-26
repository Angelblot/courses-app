-- Note Nutriscore des produits, telle qu'Open Food Facts la publie.
--
-- NULL est une valeur légitime et fréquente : le sel, le café ou les épices
-- ne reçoivent pas de note. L'absence de note ne doit donc jamais se lire
-- comme une donnée manquante à corriger.

alter table public.products add column if not exists nutriscore text;

alter table public.products drop constraint if exists products_nutriscore_valide;
alter table public.products add constraint products_nutriscore_valide
  check (nutriscore is null or nutriscore in ('a', 'b', 'c', 'd', 'e'));

comment on column public.products.nutriscore is
  'Note Nutriscore a-e depuis Open Food Facts. NULL = produit non noté.';
