/**
 * Conversion ingrédient → quantité de produit.
 * Lancer : node --test mobile/lib/unites.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUnit, convertToProductQty, isConvertible, formatIngredientQty } from './unites.ts';

test("normalise les familles d'unités", () => {
  assert.equal(normalizeUnit('g'), 'g');
  assert.equal(normalizeUnit('kg'), 'g');
  assert.equal(normalizeUnit('ml'), 'ml');
  assert.equal(normalizeUnit('L'), 'ml');
  assert.equal(normalizeUnit('gousse'), 'unité');
  assert.equal(normalizeUnit('cuillère à soupe'), 'unité');
  assert.equal(normalizeUnit('parsec'), null);
  assert.equal(normalizeUnit(''), null);
});

test('200 g de lardons dans un paquet de 200 g font un paquet', () => {
  const r = convertToProductQty(200, 'g', { unit: 'unité', grammage_g: 200 });
  assert.equal(r.qty, 1);
  assert.equal(r.approximate, true);
});

test('la quantité est arrondie au paquet supérieur, jamais en dessous', () => {
  // 250 g demandés dans des paquets de 200 g : deux paquets. En arrondir un
  // seul ferait manquer l'ingrédient.
  assert.equal(convertToProductQty(250, 'g', { unit: 'unité', grammage_g: 200 }).qty, 2);
});

test('les kilos et les litres sont ramenés avant division', () => {
  // Régression corrigée au portage : la version web divisait la quantité brute
  // par le grammage sans convertir. 1 kg de pommes de terre en sacs de 500 g
  // rendait 1 sac au lieu de 2 — mesuré sur frontend/src/lib/unitConverter.js,
  // retiré depuis (historique git)
  // le 22/08. Le gratin dauphinois et le poulet rôti comptent en kilos.
  assert.equal(convertToProductQty(1, 'kg', { unit: 'unité', grammage_g: 500 }).qty, 2);
  assert.equal(convertToProductQty(1, 'L', { unit: 'unité', volume_ml: 250 }).qty, 4);
  assert.equal(convertToProductQty(50, 'cl', { unit: 'unité', volume_ml: 250 }).qty, 2);
});

test('sans grammage connu, la conversion échoue au lieu de mentir', () => {
  // C'est ce cas que `missingGrammage` signale à l'écran : mieux vaut avouer
  // qu'on ne sait pas que de proposer une quantité inventée.
  const r = convertToProductQty(200, 'g', { unit: 'unité', grammage_g: null });
  assert.equal(r.qty, 0);
  assert.equal(r.approximate, true);
});

test('les unités dénombrables valent un pour un', () => {
  assert.equal(convertToProductQty(3, 'œufs', { unit: 'unité' }).qty, 3);
  assert.equal(convertToProductQty(2, 'gousse', { unit: 'unité' }).qty, 2);
});

test('une quantité nulle ou négative ne demande rien', () => {
  assert.equal(convertToProductQty(0, 'g', { unit: 'unité', grammage_g: 200 }).qty, 0);
  assert.equal(convertToProductQty(-5, 'g', { unit: 'unité', grammage_g: 200 }).qty, 0);
});

test("isConvertible distingue ce qui est mesurable de ce qui ne l'est pas", () => {
  assert.equal(isConvertible('g', { unit: 'unité', grammage_g: 200 }), true);
  assert.equal(isConvertible('parsec', { unit: 'unité', grammage_g: 200 }), false);
  assert.equal(isConvertible('g', { unit: 'unité', grammage_g: null }), false);
});

test("formatIngredientQty colle l'unité aux mesures, l'espace au reste", () => {
  assert.equal(formatIngredientQty(200, 'g'), '200g');
  assert.equal(formatIngredientQty(1, 'L'), '1L');
  assert.equal(formatIngredientQty(2, 'gousse'), '2 gousse');
  assert.equal(formatIngredientQty(0, 'g'), '');
});
