/**
 * Une référence et ses alternatives (variante AL3) : un classement dont le
 * premier est la référence. Siri et l'étape Habitudes ne connaissent que les
 * références ; l'extension essaie le classement dans l'ordre, en sautant les
 * marques distributeur d'une autre enseigne.
 */
import { normalizeProductType } from './typology.ts';

export type ProduitClasse = {
 id: string; name: string; brand: string | null; product_type: string | null;
 alternatives?: string[] | null; grammage_g?: number | null; volume_ml?: number | null;
};
export type Enseigne = 'carrefour' | 'leclerc';

/** Produits cités comme alternative d'une autre référence. */
export function idsAlternatives(produits: ProduitClasse[]): Set<string> {
 const ids = new Set<string>();
 for (const p of produits) for (const a of p.alternatives ?? []) if (a !== p.id) ids.add(a);
 return ids;
}

/** Les références : tout produit qui n'est l'alternative d'aucun autre. */
export function references<P extends ProduitClasse>(produits: P[]): P[] {
 const alt = idsAlternatives(produits);
 return produits.filter(p => !alt.has(p.id));
}

/** La référence et ses alternatives existantes, dans l'ordre d'essai. */
export function classement<P extends ProduitClasse>(reference: P, produits: P[]): P[] {
 const parId = new Map(produits.map(p => [p.id, p]));
 const vus = new Set([reference.id]);
 const suite: P[] = [];
 for (const id of reference.alternatives ?? []) {
  const p = parId.get(id);
  if (p && !vus.has(id)) { vus.add(id); suite.push(p); }
 }
 return [reference, ...suite];
}

/** La référence dont `id` est l'alternative, ou le produit lui-même. */
export function referenceDe<P extends ProduitClasse>(id: string, produits: P[]): P | undefined {
 return produits.find(p => (p.alternatives ?? []).includes(id) && p.id !== id) ?? produits.find(p => p.id === id);
}

/**
 * Enregistre un nouvel ordre : le premier devient la référence et porte les
 * autres ; l'ancienne référence, si elle a changé, ne porte plus rien.
 * Rend les modifications à écrire, produit par produit.
 */
export function reordonner(ancienneReference: string, ordre: string[]): { id: string; alternatives: string[] }[] {
 const [tete, ...reste] = ordre;
 const ecritures = [{ id: tete, alternatives: reste }];
 if (tete !== ancienneReference) ecritures.push({ id: ancienneReference, alternatives: [] });
 return ecritures;
}

/** La référence d'un besoin dit à Siri (« papier toilette ») : par type de produit. */
export function referencePourNom<P extends ProduitClasse>(nom: string, produits: P[]): P | undefined {
 const type = normalizeProductType(nom);
 if (!type) return undefined;
 return references(produits).find(p => p.product_type === type || normalizeProductType(p.name) === type);
}

/** Marques distributeur : un produit qui n'est vendu que par son enseigne. */
const MARQUES: { enseigne: Enseigne; motifs: RegExp }[] = [
 { enseigne: 'carrefour', motifs: /\b(carrefour|reflets de france|simpl|grand jury|bebe cash)\b/ },
 { enseigne: 'leclerc', motifs: /\b(leclerc|marque repere|eco\+|nos regions ont du talent|bio village|pouce|delisse|les croises|repere)\b/ },
];
const plat = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** L'enseigne à laquelle un produit est réservé, ou null s'il se trouve partout. */
export function enseigneExclusive(p: { name: string; brand: string | null }): Enseigne | null {
 const texte = plat(`${p.brand ?? ''} ${p.name}`);
 return MARQUES.find(m => m.motifs.test(texte))?.enseigne ?? null;
}
