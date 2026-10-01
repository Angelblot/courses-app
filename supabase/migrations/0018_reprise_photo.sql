-- « Améliorer la photo » : une photo Open Food Facts reprise en photo produit
-- sur fond blanc (fonction `ameliorer-photo`), que le foyer garde ou refuse.
--
-- image_reprise : la photo reprise, en attente de décision.
-- image_originale : la photo d'avant, gardée pour pouvoir y revenir.
-- reprise_statut / reprise_le : l'état de la reprise et son départ ; une
-- reprise « en_cours » depuis trop longtemps est considérée comme échouée.
--
-- La politique « foyer all » couvre déjà ces colonnes : chaque membre lit et
-- modifie les produits de son foyer, et d'aucun autre.

alter table public.products
  add column if not exists image_originale text,
  add column if not exists image_reprise text,
  add column if not exists reprise_statut text check (reprise_statut in ('en_cours', 'prete', 'echec')),
  add column if not exists reprise_le timestamptz;
