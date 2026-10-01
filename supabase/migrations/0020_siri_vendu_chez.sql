-- Phrases dites à Siri qui désignent un produit (« PQ »), retenues quand
-- l'app n'a pas reconnu un besoin dicté ; et le drive où il est vendu, choisi
-- à la main (null = déduit de la marque).
alter table public.products
  add column if not exists phrases_siri text[] not null default '{}',
  add column if not exists vendu_chez text
    check (vendu_chez in ('partout', 'carrefour', 'leclerc'));
