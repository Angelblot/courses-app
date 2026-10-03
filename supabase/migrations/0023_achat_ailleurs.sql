-- « Vendu chez » gagne une quatrième valeur : ailleurs (marché, primeur…).
-- Un tel produit ne part jamais au drive ; `lieu_achat` dit où l'acheter.
alter table public.products drop constraint if exists products_vendu_chez_check;
alter table public.products
  add constraint products_vendu_chez_check check (vendu_chez in ('partout', 'carrefour', 'leclerc', 'ailleurs')),
  add column if not exists lieu_achat text;
