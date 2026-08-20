/**
 * Vérifie le portage de product_typology.py.
 * Lancer : node --test mobile/lib/typology.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProductType } from './typology.ts';

test('reconnaît la charcuterie', () => {
  assert.equal(normalizeProductType('Lardons fumés Herta'), 'lardon');
  assert.equal(normalizeProductType('Allumettes de bacon'), 'lardon');
  assert.equal(normalizeProductType('Chorizo doux'), 'charcuterie');
});

test('reconnaît les pâtes et le riz', () => {
  assert.equal(normalizeProductType('Spaghetti Barilla 500g'), 'pate');
  assert.equal(normalizeProductType('Riz basmati'), 'riz');
});

test('les ravioles sont des pâtes, pas du fromage', () => {
  // La règle est placée avant celle du fromage, qui matcherait « fromage »
  // dans « ravioles au fromage ».
  assert.equal(normalizeProductType('Ravioles au fromage'), 'pate');
});

test('un nom inconnu retombe sur son premier mot significatif', () => {
  assert.equal(normalizeProductType('Tarama de cabillaud'), 'tarama');
});

test('les mots vides sont ignorés dans le repli', () => {
  assert.equal(normalizeProductType('Bio Carrefour tarama'), 'tarama');
});

test('un nom vide ne produit rien', () => {
  assert.equal(normalizeProductType(''), null);
  assert.equal(normalizeProductType(null), null);
});

test('un mot-clé encadré d\'espaces est cherché comme mot entier (régression)', () => {
  // ' biere ' (7 caractères, avec espaces) tombait auparavant dans la
  // branche « frontière à gauche » sans que les espaces marqueurs ne
  // soient retirés, ce qui exigeait deux espaces consécutifs autour de
  // "biere" dans le nom — un motif qui ne pouvait jamais correspondre.
  assert.equal(
    normalizeProductType('Bière Aromatisée Jus de Mangue et Passion Sans Alcool TOURTEL'),
    'biere'
  );
  assert.equal(normalizeProductType('Biere IPA artisanale'), 'biere');
  assert.equal(normalizeProductType('Brosse a dents souple'), 'brosse a dents');
});
