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
 /** Phrases dites à Siri qui désignent ce produit (« PQ »), retenues au fil des ratés. */
 phrases_siri?: string[] | null;
 /** Drive choisi à la main ; null = déduit de la marque. */
 vendu_chez?: VenduChez | null;
};
/** Où le produit s'achète : partout, sur un seul drive, ou hors drive (marché, primeur…). */
export type VenduChez = 'partout' | Enseigne | 'ailleurs';
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

/** Une phrase dite à Siri, comparable : minuscules, sans accents ni ponctuation. */
export function phraseSiri(s: string): string {
 return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/[^a-z0-9+]+/g, ' ').trim();
}
/** Deux phrases sont la même si seuls l'espacement et la ponctuation changent (« P.Q. » = « pq »). */
const memePhrase = (a: string, b: string) => phraseSiri(a).replace(/ /g, '') === phraseSiri(b).replace(/ /g, '');

/**
 * La référence d'un besoin dit à Siri. Une phrase retenue (« PQ ») l'emporte ;
 * sinon le type de produit (« papier toilette »).
 */
export function referencePourNom<P extends ProduitClasse>(nom: string, produits: P[]): P | undefined {
 const dite = phraseSiri(nom);
 const retenu = dite ? produits.find(p => (p.phrases_siri ?? []).some(x => memePhrase(x, dite))) : undefined;
 if (retenu) return referenceDe(retenu.id, produits);
 const type = normalizeProductType(nom);
 if (!type) return undefined;
 return references(produits).find(p => p.product_type === type || normalizeProductType(p.name) === type);
}

/**
 * Les produits qu'un besoin non reconnu désigne sans doute, les plus
 * probables d'abord : même type, puis mots en commun avec le nom.
 */
export function produitsProbables<P extends ProduitClasse>(nom: string, produits: P[], n = 4): P[] {
 const type = normalizeProductType(nom);
 const mots = phraseSiri(nom).split(' ').filter(m => m.length >= 2);
 const score = (p: P) => {
  const texte = ` ${phraseSiri(`${p.name} ${p.product_type ?? ''} ${p.brand ?? ''}`)} `;
  return (type && p.product_type === type ? 3 : 0) + mots.filter(m => texte.includes(` ${m}`)).length;
 };
 return references(produits).map(p => ({ p, s: score(p) })).filter(x => x.s > 0)
  .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name)).slice(0, n).map(x => x.p);
}

/**
 * Retient `phrase` pour `produitId` : elle s'ajoute à ses phrases et quitte
 * celles d'un autre produit, pour qu'une phrase ne désigne qu'un produit.
 * Rend les écritures à faire.
 */
export function retenirPhrase(produitId: string, phrase: string, produits: ProduitClasse[]): { id: string; phrases_siri: string[] }[] {
 const dite = phraseSiri(phrase), texte = phrase.trim().toLowerCase();
 if (!dite) return [];
 const ecritures: { id: string; phrases_siri: string[] }[] = [];
 for (const p of produits) {
  const actuelles = p.phrases_siri ?? [];
  if (p.id === produitId) {
   if (!actuelles.some(x => memePhrase(x, dite))) ecritures.push({ id: p.id, phrases_siri: [...actuelles, texte] });
  } else if (actuelles.some(x => memePhrase(x, dite))) {
   ecritures.push({ id: p.id, phrases_siri: actuelles.filter(x => !memePhrase(x, dite)) });
  }
 }
 return ecritures;
}

/** Marques distributeur : un produit qui n'est vendu que par son enseigne. */
const MARQUES: { enseigne: Enseigne; motifs: RegExp }[] = [
 { enseigne: 'carrefour', motifs: /\b(carrefour|reflets de france|simpl|grand jury|bebe cash)\b/ },
 { enseigne: 'leclerc', motifs: /\b(leclerc|marque repere|eco\+|nos regions ont du talent|bio village|pouce|delisse|les croises|repere)\b/ },
];
const plat = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** L'enseigne que la marque laisse deviner, ou null si rien ne la désigne. */
export function enseigneDeduite(p: { name: string; brand: string | null }): Enseigne | null {
 const texte = plat(`${p.brand ?? ''} ${p.name}`);
 return MARQUES.find(m => m.motifs.test(texte))?.enseigne ?? null;
}

/** L'enseigne à laquelle un produit est réservé, ou null s'il se trouve partout. Le choix manuel l'emporte. */
export function enseigneExclusive(p: { name: string; brand: string | null; vendu_chez?: VenduChez | null }): Enseigne | null {
 if (p.vendu_chez) return p.vendu_chez === 'partout' || p.vendu_chez === 'ailleurs' ? null : p.vendu_chez;
 return enseigneDeduite(p);
}

/** Le produit s'achète hors drive : il ne part jamais dans un panier. */
export function estAilleurs(p: { vendu_chez?: VenduChez | null } | null | undefined): boolean {
 return p?.vendu_chez === 'ailleurs';
}
