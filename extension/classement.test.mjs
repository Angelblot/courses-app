/** Lancer : node --test extension/classement.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { references, classement, referenceDe, familleProche, etatSurDrive, avecAlternative } from './lib/classement.js';

const produits = [
  { id: 'a', name: 'Café capsules Caramel L\'OR', alternatives: ['b'] },
  { id: 'b', name: 'Capsules Caramel Carte Noire', alternatives: [] },
  { id: 'c', name: 'Céréales Trésor', alternatives: [] },
];

test('références et classement, comme dans l’application', () => {
  assert.deepEqual(references(produits).map((p) => p.id), ['a', 'c']);
  assert.deepEqual(classement(produits[0], produits).map((p) => p.id), ['a', 'b']);
  assert.equal(referenceDe('b', produits).id, 'a');
});

test('la famille la plus proche d’une fiche, par sa référence', () => {
  assert.equal(familleProche('Capsules Caramel Carte Noire x10', produits)?.id, 'a');
  assert.equal(familleProche('Lessive liquide', produits), null);
});

test('l’état d’un produit sur un drive, et l’ajout d’une alternative', () => {
  assert.equal(etatSurDrive(null, 'u'), 'aucun');
  assert.equal(etatSurDrive({ product_url: 'u' }, 'u'), 'ici');
  assert.equal(etatSurDrive({ product_url: 'v', matched_label: 'x' }, 'u'), 'autre');
  assert.equal(etatSurDrive({ unavailable: true }, 'u'), 'absent');
  assert.deepEqual(avecAlternative(produits[0], 'n'), ['b', 'n']);
  assert.deepEqual(avecAlternative(produits[0], 'b'), ['b']);
});
