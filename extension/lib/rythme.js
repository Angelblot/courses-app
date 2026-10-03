/**
 * Rythme de navigation : les drives (DataDome chez E.Leclerc) bloquent un
 * visiteur qui enchaîne les pages « à une vitesse surhumaine ». On laisse
 * donc un intervalle minimal entre deux chargements de page, et un temps de
 * lecture une fois la page chargée, avant d'y agir.
 */

/** Écart minimal entre le début de deux chargements de page. */
export const INTERVALLE_NAVIGATION_MS = 5000;
/** Temps laissé à la page chargée avant d'y lire ou d'y cliquer. */
export const LECTURE_MS = 1500;
/** Pause entre deux produits de la liste. */
export const ENTRE_PRODUITS_MS = 4000;

/** Combien attendre avant le prochain chargement, vu le précédent. */
export function attenteAvantNavigation(precedent, maintenant, intervalle = INTERVALLE_NAVIGATION_MS) {
  if (!precedent) return 0;
  return Math.max(0, intervalle - (maintenant - precedent));
}
