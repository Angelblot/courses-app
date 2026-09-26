-- Normalise products.category : des libellés de ticket de caisse Carrefour
-- vers les clés canoniques de la table categories.
--
-- Le champ mélangeait jusqu'ici deux vocabulaires. « P.L.S. » ou
-- « CHARCUT.TRAITEUR » sont ce qu'imprime le ticket Carrefour, et
-- « ARTICLES INDISPONIBLES / NON FACTURÉS » n'est même pas un rayon mais une
-- section de ticket. La table category_aliases contenait déjà la traduction
-- exacte, elle n'avait jamais été appliquée.
--
-- Sans risque au 21/08/2026, et cette fenêtre se referme : products.category
-- n'a aujourd'hui aucun lecteur côté Supabase. Le mobile le sélectionne sans
-- l'afficher, l'extension l'ignore, et le front web interroge encore l'ancien
-- FastAPI. Dès que le wizard sera porté (lot 4), la même opération deviendra
-- une migration à risque.

update public.products p
set category = a.key_canonical
from public.category_aliases a
where a.label_raw = p.category
  and a.user_id = p.user_id;

-- Produits scannés avant ce correctif : l'insertion n'écrivait pas le rayon.
update public.products
set category = 'autre'
where category is null;
