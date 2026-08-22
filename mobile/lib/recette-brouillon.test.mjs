/**
 * Validation d'un brouillon de recette et proposition de rayon.
 * Lancer : node --test mobile/lib/recette-brouillon.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valideBrouillon, rayonPropose } from './recette-brouillon.ts';

const OK = {
  name: 'Carbonara',
  servings_default: 4,
  ingredients: [
    { name: 'Lardons', quantity_per_serving: 50, unit: 'g', rayon: 'charcuterie', product_id: null },
  ],
};

test('un brouillon complet est accepté', () => {
  assert.equal(valideBrouillon(OK), null);
});

test('une recette sans nom est refusée', () => {
  assert.match(valideBrouillon({ ...OK, name: '   ' }), /nom/i);
});

test('une recette sans ingrédient est refusée', () => {
  // Une recette vide passerait la validation puis produirait une liste vide,
  // sans que rien n'explique pourquoi.
  assert.match(valideBrouillon({ ...OK, ingredients: [] }), /ingr/i);
});

test('un nombre de parts nul ou négatif est refusé', () => {
  assert.match(valideBrouillon({ ...OK, servings_default: 0 }), /parts?/i);
});

test('un ingrédient sans nom est refusé, en indiquant sa position', () => {
  const msg = valideBrouillon({
    ...OK,
    ingredients: [{ name: '', quantity_per_serving: 1, unit: 'g', rayon: 'epicerie', product_id: null }],
  });
  assert.match(msg, /1/);
});

test('les messages sont en français, jamais un code technique', () => {
  const msg = valideBrouillon({ ...OK, name: '' });
  assert.ok(!/error|invalid|required/i.test(msg), `message technique : ${msg}`);
});

test('le rayon proposé vient du produit du catalogue de même type', () => {
  const produits = [{ product_type: 'lardon', category: 'charcuterie' }];
  assert.equal(rayonPropose('Lardons fumés', produits), 'charcuterie');
});

test('sans produit correspondant, le rayon proposé est « autre »', () => {
  assert.equal(rayonPropose('Poudre de perlimpinpin', []), 'autre');
  assert.equal(rayonPropose('', []), 'autre');
});
