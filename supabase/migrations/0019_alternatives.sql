-- Une référence et ses alternatives, dans l'ordre d'essai.
--
-- `alternatives` liste, sur le produit de référence, les produits que
-- l'extension essaie quand la référence manque au drive ou n'y est pas vendue
-- (marque distributeur d'une autre enseigne). Un produit cité comme
-- alternative n'apparaît plus seul dans les habitudes : il vit sous sa
-- référence. Un identifiant de produit supprimé est simplement ignoré.
--
-- La politique « foyer all » couvre la colonne : chaque membre modifie les
-- produits de son foyer, et d'aucun autre.

alter table public.products
  add column if not exists alternatives uuid[] not null default '{}';
