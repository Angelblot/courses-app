/**
 * Unités normalisées pour le matching recette ↔ produit.
 *
 * Convertit des quantités d'ingrédients (g, ml, kg, L, unité, oeuf, gousse…)
 * en nombre d'unités produit en utilisant le grammage/volume du conditionnement.
 */

// Unités qui se convertissent en grammes
const GRAM_UNITS = new Set([
  'g', 'gr', 'gramme', 'grammes', 'kg', 'kilo', 'kilos', 'kilogramme',
  'kilogrammes',
]);

// Unités qui se convertissent en millilitres
const ML_UNITS = new Set([
  'ml', 'millilitre', 'millilitres', 'cl', 'centilitre', 'centilitres',
  'l', 'litre', 'litres',
]);

// Unités dénombrables (1:1 avec le produit)
const COUNTABLE_UNITS = new Set([
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

/**
 * Normalise une unité en catégorie : 'g', 'ml', 'unité', ou null.
 * @param {string} unit
 * @returns {string|null}
 */
export function normalizeUnit(unit) {
  if (!unit) return null;
  const u = unit.trim().toLowerCase();

  if (GRAM_UNITS.has(u)) return 'g';
  if (ML_UNITS.has(u)) return 'ml';
  if (COUNTABLE_UNITS.has(u)) return 'unité';

  // Gestion des kg/L → conversion
  if (u === 'kg' || u === 'kilo' || u === 'kilos' || u === 'kilogramme' || u === 'kilogrammes') return 'g';
  if (u === 'l' || u === 'litre' || u === 'litres') return 'ml';
  if (u === 'cl' || u === 'centilitre' || u === 'centilitres') return 'ml';

  return null;
}

/**
 * Convertit une quantité d'ingrédient en quantité de produit (arrondi à ceil).
 *
 * @param {number} ingredientQty - Quantité dans l'unité de l'ingrédient
 * @param {string} ingredientUnit - Unité de l'ingrédient (g, ml, unité, oeuf…)
 * @param {object} product - Objet produit avec grammage_g, volume_ml, unit
 * @returns {{ qty: number, approximate: boolean }}
 */
export function convertToProductQty(ingredientQty, ingredientUnit, product) {
  if (!ingredientQty || ingredientQty <= 0) {
    return { qty: 0, approximate: false };
  }

  const ingNorm = normalizeUnit(ingredientUnit);
  const prodUnit = (product.unit || 'unité').trim().toLowerCase();

  // Cas 1: même unité normalisée → ratio direct
  if (ingNorm === normalizeUnit(prodUnit)) {
    return { qty: Math.ceil(ingredientQty), approximate: false };
  }

  // Cas 2: ingrédient en g et produit en "unité" → grammage_g
  if (ingNorm === 'g' && normalizeUnit(prodUnit) === 'unité' && product.grammage_g != null && product.grammage_g > 0) {
    return { qty: Math.ceil(ingredientQty / product.grammage_g), approximate: true };
  }

  // Cas 2b: ingrédient en kg → convertir en g d'abord
  const ingInG = _toGrams(ingredientQty, ingredientUnit);
  if (ingInG != null && normalizeUnit(prodUnit) === 'unité' && product.grammage_g != null && product.grammage_g > 0) {
    return { qty: Math.ceil(ingInG / product.grammage_g), approximate: true };
  }

  // Cas 3: ingrédient en ml et produit en "unité" → volume_ml
  if (ingNorm === 'ml' && normalizeUnit(prodUnit) === 'unité' && product.volume_ml != null && product.volume_ml > 0) {
    return { qty: Math.ceil(ingredientQty / product.volume_ml), approximate: true };
  }

  // Cas 3b: ingrédient en L/cl → convertir en ml d'abord
  const ingInMl = _toMl(ingredientQty, ingredientUnit);
  if (ingInMl != null && normalizeUnit(prodUnit) === 'unité' && product.volume_ml != null && product.volume_ml > 0) {
    return { qty: Math.ceil(ingInMl / product.volume_ml), approximate: true };
  }

  // Cas 4: unités dénombrables → ratio 1:1
  if (COUNTABLE_UNITS.has(ingredientUnit.trim().toLowerCase())) {
    return { qty: Math.ceil(ingredientQty), approximate: false };
  }

  // Cas 5: conversion impossible
  return { qty: 0, approximate: true };
}

/**
 * Vérifie si une conversion est possible entre l'unité d'ingrédient et un produit.
 * @param {string} ingredientUnit
 * @param {object} product
 * @returns {boolean}
 */
export function isConvertible(ingredientUnit, product) {
  if (!ingredientUnit || !product) return false;

  const ingNorm = normalizeUnit(ingredientUnit);
  const prodNorm = normalizeUnit(product.unit || 'unité');

  // Même unité → toujours convertible
  if (ingNorm === prodNorm) return true;

  // g → unité avec grammage_g
  if (ingNorm === 'g' && prodNorm === 'unité' && product.grammage_g != null && product.grammage_g > 0) return true;

  // ml → unité avec volume_ml
  if (ingNorm === 'ml' && prodNorm === 'unité' && product.volume_ml != null && product.volume_ml > 0) return true;

  // Unités dénombrables → convertible quel que soit le produit
  if (COUNTABLE_UNITS.has(ingredientUnit.trim().toLowerCase())) return true;

  return false;
}

/**
 * Formate une quantité avec son unité pour l'affichage.
 * @param {number} qty
 * @param {string} unit
 * @returns {string}
 */
export function formatIngredientQty(qty, unit) {
  if (qty == null || qty <= 0) return '';
  const n = Number(qty);
  const formatted = Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
  const u = (unit || '').trim().toLowerCase();

  // Ajustements grammaticaux basiques
  if (u === 'g' || u === 'gramme' || u === 'grammes') return `${formatted}g`;
  if (u === 'kg' || u === 'kilo' || u === 'kilos') return `${formatted}kg`;
  if (u === 'ml' || u === 'millilitre' || u === 'millilitres') return `${formatted}ml`;
  if (u === 'cl' || u === 'centilitre' || u === 'centilitres') return `${formatted}cl`;
  if (u === 'l' || u === 'litre' || u === 'litres') return `${formatted}L`;

  return `${formatted} ${unit}`;
}

/**
 * Convertit une quantité en grammes si possible.
 * @param {number} qty
 * @param {string} unit
 * @returns {number|null}
 */
function _toGrams(qty, unit) {
  const u = (unit || '').trim().toLowerCase();
  if (u === 'g' || u === 'gr' || u === 'gramme' || u === 'grammes') return qty;
  if (u === 'kg' || u === 'kilo' || u === 'kilos' || u === 'kilogramme' || u === 'kilogrammes') return qty * 1000;
  return null;
}

/**
 * Convertit une quantité en millilitres si possible.
 * @param {number} qty
 * @param {string} unit
 * @returns {number|null}
 */
function _toMl(qty, unit) {
  const u = (unit || '').trim().toLowerCase();
  if (u === 'ml' || u === 'millilitre' || u === 'millilitres') return qty;
  if (u === 'cl' || u === 'centilitre' || u === 'centilitres') return qty * 10;
  if (u === 'l' || u === 'litre' || u === 'litres') return qty * 1000;
  return null;
}
