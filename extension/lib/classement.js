/**
 * Le classement d'un produit, comme dans l'application (variante AL3) : une
 * référence, puis ses alternatives dans l'ordre où le panier les essaie.
 * Porté de mobile/lib/references.ts ; logique pure, testée dans classement.test.mjs.
 */
import { produitsProches } from './fiche.js';

/** Les rayons de l'application, dans le même ordre. */
export const RAYONS = [
  ['fruits_legumes', 'Fruits & légumes'], ['pls', 'Produits laitiers'], ['charcuterie', 'Charcuterie & traiteur'],
  ['boissons', 'Boissons'], ['epicerie', 'Épicerie'], ['droguerie', 'Droguerie'], ['parfumerie', 'Hygiène'],
  ['maison', 'Maison'], ['surgeles', 'Surgelés'], ['autre', 'Autres'],
];

function idsAlternatives(produits) {
  const ids = new Set();
  for (const p of produits) for (const a of p.alternatives ?? []) if (a !== p.id) ids.add(a);
  return ids;
}

/** Les références : tout produit qui n'est l'alternative d'aucun autre. */
export function references(produits) {
  const alt = idsAlternatives(produits ?? []);
  return (produits ?? []).filter((p) => !alt.has(p.id));
}

/** La référence et ses alternatives existantes, dans l'ordre d'essai. */
export function classement(reference, produits) {
  const parId = new Map((produits ?? []).map((p) => [p.id, p]));
  const vus = new Set([reference.id]), suite = [];
  for (const id of reference.alternatives ?? []) {
    const p = parId.get(id);
    if (p && !vus.has(id)) { vus.add(id); suite.push(p); }
  }
  return [reference, ...suite];
}

/** La référence dont `id` est l'alternative, ou le produit lui-même. */
export function referenceDe(id, produits) {
  return produits.find((p) => (p.alternatives ?? []).includes(id) && p.id !== id) ?? produits.find((p) => p.id === id);
}

/** La famille la plus proche d'une fiche : la référence de ton produit le plus ressemblant. */
export function familleProche(titre, produits) {
  const proche = produitsProches(titre, produits, 1)[0];
  return proche ? referenceDe(proche.id, produits) ?? null : null;
}

/**
 * Où en est un produit sur un drive, pour sa pastille : lié à la fiche ouverte,
 * à une autre fiche, noté absent, ou sans lien connu.
 * @returns {'ici' | 'autre' | 'absent' | 'aucun'}
 */
export function etatSurDrive(equivalence, urlFiche) {
  if (!equivalence) return 'aucun';
  if (equivalence.unavailable) return 'absent';
  if (urlFiche && equivalence.product_url === urlFiche) return 'ici';
  return 'autre';
}

/** Les alternatives de la référence avec un produit ajouté à la fin (sans doublon). */
export function avecAlternative(reference, id) {
  return [...(reference.alternatives ?? []).filter((x) => x !== id && x !== reference.id), id];
}
