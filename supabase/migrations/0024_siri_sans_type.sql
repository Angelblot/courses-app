-- Le type du produit (« condiment ») est reconnu par Siri d'office. Ce drapeau
-- le retire des phrases Siri de ce produit, sans toucher au type, qui sert
-- aussi aux recettes et aux suggestions.
alter table public.products
  add column if not exists siri_sans_type boolean not null default false;
