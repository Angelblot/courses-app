-- Historique des achats lu sur les factures des drives : chaque ligne garde
-- le code-barres, le libellé imprimé, le magasin, la commande et la remise,
-- même quand le produit n'est pas (ou plus) dans « Mes produits ». C'est la
-- base de l'évolution des prix par produit et par enseigne.
alter table public.purchase_lines
  alter column product_id drop not null,
  add column if not exists ean13 text,
  add column if not exists libelle text,
  add column if not exists magasin text,
  add column if not exists commande text,
  add column if not exists remise_ttc numeric(8, 2) not null default 0;

-- Une facture relue deux fois ne double pas l'historique.
create unique index if not exists purchase_lines_commande_ean_idx
  on public.purchase_lines (household_id, commande, ean13)
  where commande is not null and ean13 is not null;

create index if not exists purchase_lines_produit_date_idx
  on public.purchase_lines (household_id, product_id, purchase_date desc);
