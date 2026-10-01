/**
 * Référence et alternatives d'une ligne de courses, côté extension.
 *
 * L'application envoie, avec chaque produit de référence, ses alternatives
 * dans l'ordre d'essai. Ici on décide quoi essayer chez une enseigne, et en
 * quelle quantité.
 */

/** Raisons pour lesquelles on passe au produit suivant du classement. */
export const RAISONS_SUIVANT = new Set(['no_match', 'product_unavailable']);

/**
 * Produits à essayer chez `site`, dans l'ordre : la référence puis ses
 * alternatives, sans les marques distributeur d'une autre enseigne.
 *
 * @param {object} item Ligne : {name, quantity, ean, product_id, enseigne, grammage_g, volume_ml, alternatives}
 * @param {string} site Enseigne en cours ('carrefour' | 'leclerc')
 * @returns {object[]} Lignes prêtes pour `attempt`, avec `remplace` sur les alternatives.
 */
export function candidats(item, site) {
  const reference = { ...item, alternatives: undefined };
  const liste = [reference, ...(item.alternatives ?? []).map((a) => ({
    name: a.name,
    ean: a.ean13 ?? null,
    product_id: a.product_id ?? null,
    enseigne: a.enseigne ?? null,
    quantity: quantitePour(item, a, item.quantity),
    remplace: item.name,
  }))];
  return liste.filter((c) => !c.enseigne || c.enseigne === site);
}

/**
 * Nombre d'articles d'une alternative pour couvrir la même quantité totale
 * que la référence : 2 paquets de 100 g pour 1 paquet de 200 g. Sans format
 * comparable, un article remplace un article.
 */
export function quantitePour(reference, alternative, quantite) {
  const q = Math.max(1, Math.round(quantite || 1));
  const paire = (cle) => reference?.[cle] > 0 && alternative?.[cle] > 0;
  if (paire('grammage_g')) return Math.max(1, Math.ceil((q * reference.grammage_g) / alternative.grammage_g));
  if (paire('volume_ml')) return Math.max(1, Math.ceil((q * reference.volume_ml) / alternative.volume_ml));
  return q;
}
