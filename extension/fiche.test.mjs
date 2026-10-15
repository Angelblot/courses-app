/** Lancer : node --test extension/fiche.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { produitsProches, chercherProduits, motsUtiles } from './lib/fiche.js';

const produits = [
  { id: 'a', name: 'Café capsules Caramel L\'OR' }, { id: 'b', name: 'Café capsules Vanille L\'OR' },
  { id: 'c', name: 'Céréales Trésor Chocolat au Lait' }, { id: 'd', name: 'Café capsules Noisette L\'OR' },
];

test('les mots utiles d’un libellé', () => {
  assert.deepEqual(motsUtiles('Capsules café L\'Or Espresso Saveur Caramel x10'), ['capsule', 'cafe', 'espresso', 'caramel']);
});

test('le produit le plus proche de la fiche vient en tête', () => {
  const r = produitsProches('Capsules café L\'Or Espresso Saveur Caramel x10', produits);
  assert.equal(r[0].id, 'a');
  assert.ok(!r.some((p) => p.id === 'c'));
});

test('chercher dans tes produits, sans accents', () => {
  assert.deepEqual(chercherProduits('cereales', produits).map((p) => p.id), ['c']);
  assert.deepEqual(chercherProduits('c', produits), []);
});
