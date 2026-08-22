/**
 * Choix de la voie d'accès à un produit chez une enseigne, d'après ce qui a
 * été mémorisé lors des commandes précédentes.
 *
 * C'est ce qui rend les commandes suivantes déterministes : une ambiguïté
 * tranchée une fois ne se repose plus.
 */

/**
 * @param {object|null} equivalence Ligne de `product_equivalents`, ou null.
 * @returns {{voie: 'url'|'label'|'absent'|'recherche', valeur: string|null}}
 */
export function strategie(equivalence) {
  if (!equivalence) return { voie: 'recherche', valeur: null };
  // L'indisponibilité prime : inutile de chercher ce qu'on sait absent.
  if (equivalence.unavailable) return { voie: 'absent', valeur: null };
  if (equivalence.product_url) return { voie: 'url', valeur: equivalence.product_url };
  // Seule voie chez Leclerc, dont les liens produit n'ont pas d'adresse.
  if (equivalence.matched_label) return { voie: 'label', valeur: equivalence.matched_label };
  return { voie: 'recherche', valeur: null };
}

/** Indexe les équivalences par identifiant de produit. */
export function indexer(lignes) {
  const m = new Map();
  for (const l of lignes ?? []) {
    if (l?.product_id) m.set(l.product_id, l);
  }
  return m;
}
