-- Lire la fiche d'un produit sur le drive pour le comparer : taille des
-- feuilles, largeur d'un rouleau, nombre de lavages… souvent absents du
-- libellé. L'app demande la lecture (recherches_drive de type « fiche »),
-- l'extension ouvre la fiche à rythme humain et en range le texte utile.
alter table public.recherches_drive
  add column if not exists type text not null default 'recherche' check (type in ('recherche', 'fiche')),
  add column if not exists offre_id uuid references public.offres_drive (id) on delete cascade,
  add column if not exists url text;

alter table public.offres_drive
  add column if not exists fiche_texte text,
  add column if not exists fiche_lue_le timestamptz;
