/** Lancer : node --test mobile/lib/pieces.test.mjs (Node >= 22) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { piecesDansTexte, piecesDuProduit } from './pieces.ts';

test('lit le nombre de pièces dans un libellé', () => {
  assert.equal(piecesDansTexte('Bananes Panier du Primeur mûries - x5'), 5);
  assert.equal(piecesDansTexte('Œufs frais Plein Air x12'), 12);
  assert.equal(piecesDansTexte('Boîte de 6 œufs'), 6);
  assert.equal(piecesDansTexte('6 oeufs bio'), 6);
  assert.equal(piecesDansTexte('Yaourts nature 4 x 125 g'), 4);
  assert.equal(piecesDansTexte('Yaourts nature 4x125g'), 4);
});

test('ne prend pas un poids ou un volume pour des pièces', () => {
  assert.equal(piecesDansTexte('Œufs Plein Air'), null);
  assert.equal(piecesDansTexte('Coriandre Florette 11g'), null);
  assert.equal(piecesDansTexte('Crème entière 30% MG - 25cl'), null);
  assert.equal(piecesDansTexte('Patate douce bio 500g'), null);
  assert.equal(piecesDansTexte('Lait x 1,5 L'), null);
  assert.equal(piecesDansTexte('1 pièce'), null);
});

test('la fiche prime sur le nom', () => {
  assert.equal(piecesDuProduit({ nombre_unites: 10, name: 'Œufs x6' }), 10);
  assert.equal(piecesDuProduit({ nombre_unites: null, name: 'Œufs x6' }), 6);
  assert.equal(piecesDuProduit({ name: 'Œufs Plein Air' }), null);
});
