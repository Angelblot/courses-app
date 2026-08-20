-- Correctifs de relecture sur 0002_catalogue.sql (déjà appliquée).
-- Ne modifie pas la migration d'origine : ceci est une migration de suivi.

-- 1. Index manquants sur user_id (Important).
-- user_id est la colonne testée par la politique RLS "owner all" de chaque
-- table, donc la colonne la plus interrogée du schéma. categories,
-- category_aliases et product_equivalents sont déjà couvertes par leur
-- contrainte unique (user_id, ...), qui fait office d'index dont user_id est
-- la colonne de tête. recipes, recipe_ingredients et purchase_lines n'ont pas
-- une telle contrainte : sans index dédié, chaque évaluation de la politique
-- RLS force un scan complet de la table.
create index recipes_user_idx on public.recipes (user_id);
create index recipe_ingredients_user_idx on public.recipe_ingredients (user_id);
create index purchase_lines_user_idx on public.purchase_lines (user_id);

-- 2. Contrainte manquante sur purchase_lines.drive (Important).
-- product_equivalents.drive porte déjà check (drive in ('carrefour',
-- 'leclerc')) : purchase_lines.drive désigne la même enseigne mais restait un
-- texte libre, ce qui laissait s'accumuler des variantes ('Carrefour',
-- 'CARREFOUR ') cassant les agrégations par enseigne.
-- Vérifié avant application : la table purchase_lines est vide à ce stade
-- (0 ligne), donc aucune donnée existante ne peut violer la contrainte.
alter table public.purchase_lines
  add constraint purchase_lines_drive_check check (drive in ('carrefour', 'leclerc'));

-- 3. Sémantique NULL non documentée (Mineur).
-- La contrainte unique (user_id, ean13) est ce qui détecte un doublon au
-- scan. En Postgres, NULL n'est jamais égal à NULL : plusieurs produits sans
-- code-barres coexistent donc sans erreur pour un même utilisateur. C'est le
-- comportement voulu (tous les produits n'ont pas d'EAN), pas un oubli.
comment on constraint products_user_id_ean13_key on public.products is
  'Détecte les doublons au scan par (user_id, ean13). NULL <> NULL en Postgres : '
  'plusieurs produits sans code-barres (ean13 NULL) coexistent donc librement '
  'pour un même utilisateur — comportement voulu, à ne pas "corriger".';

-- 4. Catégories non normalisées (Mineur).
-- products.category (comme recipe_ingredients.category / .rayon /
-- .category_hint) est un texte libre, sans clé étrangère vers categories.key.
-- category_aliases existe pour cette résolution, mais elle se fait côté
-- application, pas via contrainte en base : choix assumé, pas un oubli.
comment on column public.products.category is
  'Texte libre, non contraint par une clé étrangère vers categories.key. La '
  'résolution vers une catégorie canonique se fait côté application, via '
  'category_aliases — choix assumé, pas un oubli de contrainte.';
