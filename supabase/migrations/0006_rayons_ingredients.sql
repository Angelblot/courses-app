-- Normalise recipe_ingredients.rayon vers les clés canoniques de la table
-- categories, comme 0005 l'a fait pour products.category.
--
-- Ce champ portait un troisième vocabulaire, saisi à la main :
-- « Produits laitiers », « Fruits et légumes », « Boucherie ». Sans cette
-- normalisation, le récapitulatif du wizard afficherait le même rayon deux
-- fois sous deux noms — les ingrédients d'un côté, les produits de l'autre.
--
-- « Boucherie » devient pls : les 10 rayons viennent des sections du ticket
-- Carrefour, où la boucherie n'existe pas. « Filets de poulet jaune
-- CARREFOUR » y est rangé en P.L.S., et c'est là que l'utilisateur ira le
-- chercher dans le drive.

update public.recipe_ingredients set rayon = case
  when lower(rayon) like 'produits laitiers%' then 'pls'
  when lower(rayon) like 'boucherie%'          then 'pls'
  when lower(rayon) like 'fruits%'             then 'fruits_legumes'
  when lower(rayon) like 'charcuterie%'        then 'charcuterie'
  when lower(rayon) like '%picerie%'           then 'epicerie'
  when lower(rayon) like 'boissons%'           then 'boissons'
  when lower(rayon) like 'surgel%'             then 'surgeles'
  else 'autre'
end
where rayon is not null;

update public.recipe_ingredients set rayon = 'autre' where rayon is null;
