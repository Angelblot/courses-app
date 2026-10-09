/**
 * Le nombre de pièces d'un conditionnement : une boîte de 6 œufs, un régime
 * de 5 bananes, un pack de 4 yaourts. Logique pure, sans Supabase ni React
 * Native.
 *
 * Sans lui, une recette qui demande 6 œufs faisait acheter 6 boîtes.
 */

const MOTS_PIECES = 'œufs?|oeufs?|pi[eè]ces?|pcs|unit[eé]s?|tranches?|sachets?|capsules?|dosettes?|pots?|rouleaux?|portions?|briques?|bouteilles?|canettes?|fruits?|bananes?|citrons?|avocats?|steaks?|saucisses?|galettes?|crêpes?|crepes?';
const MESURE = '(?:kg|g|mg|cl|ml|l)\\b';
const MOTIFS: RegExp[] = [
  // « 6 x 125 g » : le premier nombre compte les pièces.
  new RegExp(`(\\d{1,3})\\s*[x×]\\s*\\d+(?:[.,]\\d+)?\\s*${MESURE}`, 'i'),
  // « x6 », « x 12 » — mais pas « x125 g ».
  new RegExp(`(?:^|[\\s(\\-])[x×]\\s?(\\d{1,3})(?!\\s*[.,]?\\d)(?!\\s*${MESURE})`, 'i'),
  // « boîte de 6 », « lot de 4 », « pack de 12 ».
  /\b(?:bo[iî]te|lot|pack|paquet|barquette|plaquette|filet|sachet|boite|r[eé]gime|carton|étui|etui)\s+de\s+(\d{1,3})\b/i,
  // « 6 œufs », « 12 pièces ».
  new RegExp(`(?:^|[^\\d.,])(\\d{1,3})\\s*(?:${MOTS_PIECES})(?![\\p{L}])`, 'iu'),
];

/** Le nombre de pièces lu dans un libellé, ou null. Un seul ne compte pas. */
export function piecesDansTexte(texte: string | null | undefined): number | null {
  if (!texte) return null;
  for (const motif of MOTIFS) {
    const m = motif.exec(texte);
    const n = m ? Number(m[1]) : NaN;
    if (n > 1 && n <= 500) return n;
  }
  return null;
}

/** Les pièces d'un produit : renseignées sur sa fiche, sinon lues dans son nom. */
export function piecesDuProduit(p: { nombre_unites?: number | null; name?: string | null } | null | undefined): number | null {
  if (!p) return null;
  if (p.nombre_unites != null && p.nombre_unites > 1) return p.nombre_unites;
  return piecesDansTexte(p.name);
}
