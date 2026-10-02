/**
 * Ce qui départage deux produits semblables : scores (Nutri-Score, NOVA,
 * Eco-Score), repères pour 100 g avec leur niveau, allergènes, portion et
 * ingrédients, lus sur Open Food Facts. Logique pure, testée hors app.
 */

export type Niveau = 'low' | 'moderate' | 'high';
export type Details = {
 kcal: number | null; gras: number | null; satures: number | null; sucres: number | null; sel: number | null;
 fibres: number | null; proteines: number | null;
 niveaux: { gras?: Niveau; satures?: Niveau; sucres?: Niveau; sel?: Niveau };
 nova: 1 | 2 | 3 | 4 | null; ecoscore: 'a' | 'b' | 'c' | 'd' | 'e' | null;
 allergenes: string[]; ingredients: string | null; portion: string | null;
};
export type OffNutrition = {
 nutriments?: Record<string, unknown>; nutrient_levels?: Record<string, unknown>;
 nova_group?: unknown; ecoscore_grade?: unknown; allergens_tags?: unknown;
 ingredients_text_fr?: unknown; ingredients_text?: unknown; serving_size?: unknown;
};

/** Champs Open Food Facts à demander en plus pour avoir les détails. */
export const CHAMPS_DETAILS = 'nutriments,nutrient_levels,nova_group,ecoscore_grade,allergens_tags,ingredients_text_fr,ingredients_text,serving_size';

const ALLERGENES: Record<string, string> = {
 gluten: 'gluten', milk: 'lait', eggs: 'œufs', soybeans: 'soja', nuts: 'fruits à coque', peanuts: 'arachides',
 fish: 'poisson', crustaceans: 'crustacés', molluscs: 'mollusques', celery: 'céleri', mustard: 'moutarde',
 'sesame-seeds': 'sésame', 'sulphur-dioxide-and-sulphites': 'sulfites', lupin: 'lupin',
};
const nombre = (v: unknown) => { const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };
const niveau = (v: unknown): Niveau | undefined => (v === 'low' || v === 'moderate' || v === 'high' ? v : undefined);

/** Les détails d'un produit, ou null quand Open Food Facts n'a aucun repère nutritionnel. */
export function lireDetails(p: OffNutrition | null | undefined): Details | null {
 if (!p) return null;
 const n = p.nutriments ?? {}, l = p.nutrient_levels ?? {};
 const kcal = nombre(n['energy-kcal_100g']), gras = nombre(n['fat_100g']), satures = nombre(n['saturated-fat_100g']);
 const sucres = nombre(n['sugars_100g']), sel = nombre(n['salt_100g']);
 const nova = Number(p.nova_group);
 const eco = typeof p.ecoscore_grade === 'string' ? p.ecoscore_grade.toLowerCase() : '';
 const d: Details = {
  kcal, gras, satures, sucres, sel, fibres: nombre(n['fiber_100g']), proteines: nombre(n['proteins_100g']),
  niveaux: { gras: niveau(l['fat']), satures: niveau(l['saturated-fat']), sucres: niveau(l['sugars']), sel: niveau(l['salt']) },
  nova: [1, 2, 3, 4].includes(nova) ? nova as Details['nova'] : null,
  ecoscore: /^[a-e]$/.test(eco) ? eco as Details['ecoscore'] : null,
  allergenes: (Array.isArray(p.allergens_tags) ? p.allergens_tags : []).map(t => String(t).replace(/^[a-z]{2}:/, '')).map(t => ALLERGENES[t] ?? t.replace(/-/g, ' ')),
  ingredients: typeof (p.ingredients_text_fr || p.ingredients_text) === 'string' ? String(p.ingredients_text_fr || p.ingredients_text).replace(/_/g, '').trim() || null : null,
  portion: typeof p.serving_size === 'string' && p.serving_size.trim() ? p.serving_size.trim().slice(0, 40) : null,
 };
 return [kcal, gras, sucres, sel].some(v => v != null) || d.nova || d.ecoscore ? d : null;
}

const RANG = ['a', 'b', 'c', 'd', 'e'];
export type Ligne = { cle: string; libelle: string; meilleur: number[] };

/**
 * Pour un tableau comparatif : sur chaque ligne, les colonnes les meilleures
 * (moins de sucres, de sel, de gras ; meilleur Nutri-Score ou Eco-Score ;
 * moins transformé ; moins d'allergènes). Une ligne sans écart n'a pas de gagnant.
 */
export function meilleurs(produits: { nutriscore: string | null; details: Details | null }[]): Record<string, number[]> {
 const lignes: Record<string, (p: { nutriscore: string | null; details: Details | null }) => number | null> = {
  nutriscore: p => (p.nutriscore ? RANG.indexOf(p.nutriscore) : null),
  ecoscore: p => (p.details?.ecoscore ? RANG.indexOf(p.details.ecoscore) : null),
  nova: p => p.details?.nova ?? null,
  kcal: p => p.details?.kcal ?? null, gras: p => p.details?.gras ?? null, satures: p => p.details?.satures ?? null,
  sucres: p => p.details?.sucres ?? null, sel: p => p.details?.sel ?? null,
  allergenes: p => (p.details ? p.details.allergenes.length : null),
 };
 const res: Record<string, number[]> = {};
 for (const [cle, f] of Object.entries(lignes)) {
  const v = produits.map(f), connus = v.filter((x): x is number => x != null);
  if (connus.length < 2) { res[cle] = []; continue; }
  const min = Math.min(...connus), max = Math.max(...connus);
  res[cle] = min === max ? [] : v.flatMap((x, i) => (x === min ? [i] : []));
 }
 return res;
}
