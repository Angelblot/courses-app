-- Ce que l'extension a vu quand une recherche revient vide ou échoue :
-- adresse et titre de chaque cadre, cartes reconnues par sélecteur. Sans lui,
-- un « rien trouvé » systématique sur un drive reste inexplicable.
alter table public.recherches_drive
  add column if not exists diagnostic jsonb;
