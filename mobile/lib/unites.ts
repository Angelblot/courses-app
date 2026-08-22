/**
 * Unités normalisées pour le rapprochement recette ↔ produit.
 *
 * Porté de frontend/src/lib/unitConverter.js. Convertit une quantité
 * d'ingrédient (g, ml, kg, L, unité, œuf, gousse…) en nombre d'articles à
 * mettre au panier, à partir du conditionnement du produit.
 */

export type ProduitMesure = {
  unit?: string | null;
  grammage_g?: number | null;
  volume_ml?: number | null;
};

export type UniteNormalisee = 'g' | 'ml' | 'unité';

const GRAM_UNITS: ReadonlySet<string> = new Set([
  'g', 'gr', 'gramme', 'grammes', 'kg', 'kilo', 'kilos', 'kilogramme',
  'kilogrammes',
]);

const ML_UNITS: ReadonlySet<string> = new Set([
  'ml', 'millilitre', 'millilitres', 'cl', 'centilitre', 'centilitres',
  'l', 'litre', 'litres',
]);

/** Unités dénombrables : un ingrédient vaut un article. */
const COUNTABLE_UNITS: ReadonlySet<string> = new Set([
  'unité', 'unites', 'unite', 'pièce', 'pièces', 'piece', 'pieces',
  'oeuf', 'oeufs', 'œuf', 'œufs',
  'gousse', 'gousses',
  'branche', 'branches',
  'tranche', 'tranches',
  'sachet', 'sachets',
  'boîte', 'boites', 'boite',
  'botte', 'bottes',
  'paquet', 'paquets',
  'pincée', 'pincées', 'pincee', 'pincees',
  'cuillère à soupe', 'cuillères à soupe', 'c. à soupe', 'cs',
  'cuillère à café', 'cuillères à café', 'c. à café', 'cc',
]);

/** Ramène une unité à sa famille : `g`, `ml`, `unité`, ou `null`. */
export function normalizeUnit(unit: string | null | undefined): UniteNormalisee | null {
  if (!unit) return null;
  const u = unit.trim().toLowerCase();
  if (GRAM_UNITS.has(u)) return 'g';
  if (ML_UNITS.has(u)) return 'ml';
  if (COUNTABLE_UNITS.has(u)) return 'unité';
  return null;
}

/** Quantité exprimée en grammes, ou `null` si l'unité n'est pas une masse. */
function versGrammes(qty: number, unit: string): number | null {
  const u = (unit || '').trim().toLowerCase();
  if (u === 'g' || u === 'gr' || u === 'gramme' || u === 'grammes') return qty;
  if (u === 'kg' || u === 'kilo' || u === 'kilos' || u === 'kilogramme' || u === 'kilogrammes') {
    return qty * 1000;
  }
  return null;
}

/** Quantité exprimée en millilitres, ou `null` si l'unité n'est pas un volume. */
function versMillilitres(qty: number, unit: string): number | null {
  const u = (unit || '').trim().toLowerCase();
  if (u === 'ml' || u === 'millilitre' || u === 'millilitres') return qty;
  if (u === 'cl' || u === 'centilitre' || u === 'centilitres') return qty * 10;
  if (u === 'l' || u === 'litre' || u === 'litres') return qty * 1000;
  return null;
}

/**
 * Convertit une quantité d'ingrédient en nombre d'articles.
 *
 * L'arrondi est toujours au supérieur : acheter un paquet de trop se rattrape,
 * un paquet de moins fait manquer l'ingrédient.
 *
 * `approximate` signale que la quantité résulte d'une division par un
 * conditionnement, et non d'une correspondance exacte — l'écran l'affiche.
 */
export function convertToProductQty(
  ingredientQty: number,
  ingredientUnit: string,
  product: ProduitMesure,
): { qty: number; approximate: boolean } {
  if (!ingredientQty || ingredientQty <= 0) return { qty: 0, approximate: false };

  const ingNorm = normalizeUnit(ingredientUnit);
  const prodNorm = normalizeUnit(product.unit || 'unité');

  // Même famille d'unité : rapport direct.
  if (ingNorm !== null && ingNorm === prodNorm) {
    return { qty: Math.ceil(ingredientQty), approximate: false };
  }

  // Masse vers articles. On convertit AVANT de diviser : la version web
  // divisait la quantité brute, si bien que « 1 kg » dans des sacs de 500 g
  // rendait 1 sac au lieu de 2. Mesuré sur unitConverter.js le 22/08 — le
  // gratin dauphinois et le poulet rôti comptent leurs légumes en kilos.
  if (prodNorm === 'unité' && product.grammage_g != null && product.grammage_g > 0) {
    const enGrammes = versGrammes(ingredientQty, ingredientUnit);
    if (enGrammes != null) {
      return { qty: Math.ceil(enGrammes / product.grammage_g), approximate: true };
    }
  }

  // Volume vers articles, même raisonnement.
  if (prodNorm === 'unité' && product.volume_ml != null && product.volume_ml > 0) {
    const enMl = versMillilitres(ingredientQty, ingredientUnit);
    if (enMl != null) {
      return { qty: Math.ceil(enMl / product.volume_ml), approximate: true };
    }
  }

  // Unités dénombrables : un pour un.
  if (COUNTABLE_UNITS.has((ingredientUnit || '').trim().toLowerCase())) {
    return { qty: Math.ceil(ingredientQty), approximate: false };
  }

  // Conversion impossible : on rend 0 en le signalant, plutôt qu'un nombre
  // inventé. C'est ce cas que `missingGrammage` explique à l'écran.
  return { qty: 0, approximate: true };
}

/** Dit si une quantité d'ingrédient peut se traduire en articles de ce produit. */
export function isConvertible(
  ingredientUnit: string | null | undefined,
  product: ProduitMesure | null | undefined,
): boolean {
  if (!ingredientUnit || !product) return false;

  const ingNorm = normalizeUnit(ingredientUnit);
  const prodNorm = normalizeUnit(product.unit || 'unité');

  if (ingNorm !== null && ingNorm === prodNorm) return true;
  if (ingNorm === 'g' && prodNorm === 'unité' && (product.grammage_g ?? 0) > 0) return true;
  if (ingNorm === 'ml' && prodNorm === 'unité' && (product.volume_ml ?? 0) > 0) return true;
  if (COUNTABLE_UNITS.has(ingredientUnit.trim().toLowerCase())) return true;

  return false;
}

/** Met une quantité en forme pour l'affichage : « 200g », « 1L », « 2 gousse ». */
export function formatIngredientQty(qty: number, unit: string): string {
  if (qty == null || qty <= 0) return '';
  const n = Number(qty);
  const texte = Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
  const u = (unit || '').trim().toLowerCase();

  if (u === 'g' || u === 'gramme' || u === 'grammes') return `${texte}g`;
  if (u === 'kg' || u === 'kilo' || u === 'kilos') return `${texte}kg`;
  if (u === 'ml' || u === 'millilitre' || u === 'millilitres') return `${texte}ml`;
  if (u === 'cl' || u === 'centilitre' || u === 'centilitres') return `${texte}cl`;
  if (u === 'l' || u === 'litre' || u === 'litres') return `${texte}L`;

  return `${texte} ${unit}`;
}
