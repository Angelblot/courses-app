/**
 * Ce que chaque drive connaît d'un produit. Un lien, c'est un drive où le
 * produit a déjà été acheté ou mis au panier, ou dont la fiche est
 * mémorisée. « Absent » : on a constaté qu'il n'y est pas vendu. Sinon, pas
 * de lien : l'extension le cherchera (par code-barres chez Carrefour, par
 * nom chez E.Leclerc). Rien ici ne parle à Supabase.
 */
import { enseigneExclusive, estAilleurs, type Enseigne, type ProduitClasse } from './references.ts';

export const DRIVES_LIENS: Enseigne[] = ['carrefour', 'leclerc'];

/** Ce que la base sait d'un produit sur chaque drive. */
export type FaitsLiens = {
  /** Drives où il a été acheté (factures, tickets) ou mis au panier par l'extension. */
  connus: Set<Enseigne>;
  /** Drives où il est marqué absent. */
  absents: Set<Enseigne>;
};

export type EtatDrive =
  /** Le drive connaît le produit. */
  | 'relie'
  /** On sait qu'il n'y est pas vendu. */
  | 'absent'
  /** Le drive ne le connaît pas encore. */
  | 'aucun'
  /** Sans objet : réservé à l'autre drive, ou acheté ailleurs. */
  | 'hors';

export type CategorieLiens = 'aucun' | 'carrefour' | 'leclerc' | 'deux' | 'ailleurs';

export function etatDrive(p: ProduitClasse, drive: Enseigne, faits: FaitsLiens | undefined): EtatDrive {
  if (estAilleurs(p)) return 'hors';
  const seul = enseigneExclusive(p);
  if (seul && seul !== drive) return 'hors';
  if (faits?.connus.has(drive)) return 'relie';
  if (faits?.absents.has(drive)) return 'absent';
  return 'aucun';
}

/**
 * Où ranger le produit dans le récapitulatif. Un produit réservé à un drive
 * qui le connaît compte comme « relié aux deux » : il n'y a rien à régler.
 */
export function categorieLiens(p: ProduitClasse, faits: FaitsLiens | undefined): CategorieLiens {
  if (estAilleurs(p)) return 'ailleurs';
  const c = etatDrive(p, 'carrefour', faits), l = etatDrive(p, 'leclerc', faits);
  const ok = (e: EtatDrive) => e === 'relie' || e === 'hors';
  if (c === 'relie' && ok(l)) return 'deux';
  if (l === 'relie' && ok(c)) return 'deux';
  if (c === 'relie') return 'carrefour';
  if (l === 'relie') return 'leclerc';
  return 'aucun';
}

const NOMS: Record<Enseigne, string> = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' };
const MOTS: Record<EtatDrive, string> = { relie: 'relié', absent: 'absent', aucun: 'pas de lien', hors: '' };

/** Une phrase pour la fiche : « Carrefour : relié · E.Leclerc : absent ». */
export function resumeLiens(p: ProduitClasse, faits: FaitsLiens | undefined): string {
  if (estAilleurs(p)) return 'Acheté hors drive';
  return DRIVES_LIENS.map(d => ({ d, e: etatDrive(p, d, faits) })).filter(x => x.e !== 'hors')
    .map(x => `${NOMS[x.d]} : ${MOTS[x.e]}`).join(' · ');
}

/** Pour la ligne de la fiche : les drives reliés, « Hors drive », ou rien. */
export function courtLiens(p: ProduitClasse, faits: FaitsLiens | undefined): string {
  if (estAilleurs(p)) return 'Hors drive';
  return DRIVES_LIENS.filter(d => etatDrive(p, d, faits) === 'relie').map(d => NOMS[d]).join(' · ');
}

/** Indexe les faits par produit, à partir des lignes lues dans la base. */
export function indexerFaits(
  achats: { product_id: string | null; drive: string | null }[],
  equivalences: { product_id: string; drive: string; unavailable: boolean }[],
): Map<string, FaitsLiens> {
  const m = new Map<string, FaitsLiens>();
  const faits = (id: string) => { let f = m.get(id); if (!f) { f = { connus: new Set(), absents: new Set() }; m.set(id, f); } return f; };
  const drive = (d: string | null): Enseigne | null => d === 'carrefour' || d === 'leclerc' ? d : null;
  for (const a of achats) { const d = drive(a.drive); if (a.product_id && d) faits(a.product_id).connus.add(d); }
  for (const e of equivalences) { const d = drive(e.drive); if (!d) continue; if (e.unavailable) faits(e.product_id).absents.add(d); else faits(e.product_id).connus.add(d); }
  // Un produit acheté sur un drive n'y est pas absent, quoi qu'en dise un vieux relevé.
  for (const f of m.values()) for (const d of f.connus) f.absents.delete(d);
  return m;
}
