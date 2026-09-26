-- Temps de préparation, de cuisson et calories par portion.
--
-- Ces trois informations sont publiées par les sites de cuisine dans leur
-- bloc schema.org — `prepTime`, `cookTime` et `nutrition.calories` — et
-- n'étaient tout simplement pas reprises à l'import.
--
-- Toutes nullables : une recette saisie à la main n'en a pas, et les
-- inventer serait pire que de les taire.
alter table public.recipes
  add column if not exists prep_minutes integer,
  add column if not exists cook_minutes integer,
  add column if not exists kcal_per_serving integer;

-- Une durée négative n'a pas de sens ; zéro en a un — « aucune cuisson ».
alter table public.recipes
  add constraint recipes_prep_minutes_positif check (prep_minutes is null or prep_minutes >= 0),
  add constraint recipes_cook_minutes_positif check (cook_minutes is null or cook_minutes >= 0),
  add constraint recipes_kcal_positif check (kcal_per_serving is null or kcal_per_serving > 0);
