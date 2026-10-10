/**
 * Trancher seul une ambiguïté, quand c'est sûr : plusieurs formats d'un même
 * produit obtiennent le même score textuel (« Crème 25 cl » et « 3 x 20 cl »).
 * Logique pure, testée dans departage.test.mjs.
 */
import { lireContenance } from './offres.js';

const plat = (t) => String(t ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const pieces = (t) => { const m = plat(t).match(/(?:^|[\s(-])x\s?(\d{1,3})\b(?!\s*[,.]?\d*\s*(?:kg|g|cl|ml|l)\b)/); return m ? Number(m[1]) : null; };
// Le libellé sans son format : deux formats d'un même produit ont la même base.
const base = (t) => plat(t).replace(/(\d{1,3}\s*[x×]\s*)?\d+([.,]\d+)?\s*(kg|g|cl|ml|l)\b/g, ' ').replace(/(?:^|\s)[x×]\s?\d{1,3}\b/g, ' ')
  .replace(/[-–·]/g, ' ').replace(/\s+/g, ' ').trim();
const proche = (a, b) => Math.abs(a - b) <= Math.max(1, 0.02 * Math.max(a, b));

/**
 * Le libellé à prendre parmi les candidats ambigus, ou null s'il faut laisser
 * choisir. `item` porte le nom demandé et, quand on la connaît, la contenance
 * de la référence (grammage_g, volume_ml).
 * @returns {{ label: string, raison: 'libelle' | 'format' } | null}
 */
export function departager(item, candidats) {
  const liste = (candidats ?? []).filter((c) => c?.label);
  if (liste.length < 2) return null;
  // 1. Un candidat porte exactement le nom demandé.
  const exacts = liste.filter((c) => plat(c.label) === plat(item.name));
  if (exacts.length === 1) return { label: exacts[0].label, raison: 'libelle' };
  // 2. Un seul a le format de la référence : contenance, et nombre de pièces s'il est dit.
  const lu = lireContenance(item.name);
  const g = item.grammage_g ?? lu?.grammage_g ?? null, ml = item.volume_ml ?? lu?.volume_ml ?? null, n = pieces(item.name);
  if (g == null && ml == null && n == null) return null;
  const memes = liste.filter((c) => {
    const f = lireContenance(c.label), p = pieces(c.label);
    if (g != null && !(f?.grammage_g != null && proche(f.grammage_g, g))) return false;
    if (ml != null && !(f?.volume_ml != null && proche(f.volume_ml, ml))) return false;
    if (n != null && p !== n) return false;
    return true;
  });
  if (memes.length !== 1) return null;
  // Seulement entre formats d'un même produit : un Cheddar d'une autre marque au
  // même poids n'est pas « le bon format », c'est un autre produit.
  const b = base(memes[0].label);
  return liste.some((c) => c !== memes[0] && base(c.label) === b) ? { label: memes[0].label, raison: 'format' } : null;
}
