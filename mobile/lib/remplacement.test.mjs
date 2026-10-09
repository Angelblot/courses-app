/** Lancer : node --test mobile/lib/remplacement.test.mjs (Node >= 22) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offresPertinentes, recherchesPlusCourtes, itemsDesRemplacements, quantiteRemplacement } from './remplacement.ts';

const o = (libelle, rang, x = {}) => ({ libelle, rang, drive: 'carrefour', recherche: 'Ail blanc 1p', ean13: null, prix: 1, ...x });

test('les offres vues qui parlent du produit, sans les piquets de tente', () => {
  const offres = [o('BLVIE Piquets De Tente À Visser (blanc Luminescent, 10 Pièces)', 0), o('Ail blanc filet 3 têtes', 1), o('Ail blanc filet 3 têtes', 2), o('Ail rose', 3, { drive: 'leclerc' })];
  assert.deepEqual(offresPertinentes(offres, 'Ail blanc 1p', 'carrefour').map(x => x.libelle), ['Ail blanc filet 3 têtes']);
  // Une offre Carrefour rangée sous E.Leclerc n'est pas proposée chez Leclerc.
  assert.deepEqual(offresPertinentes([o('Ail blanc filet', 0, { drive: 'leclerc', url: 'https://www.carrefour.fr/p/ail-123' })], 'Ail blanc 1p', 'leclerc'), []);
  const creme = [o('Crème entière fluide UHT Bio Carrefour Bio 20 cl', 0, { recherche: 'Crème entière Bio Village 25cl' }), o('Lait demi-écrémé', 1, { recherche: 'Crème entière Bio Village 25cl' })];
  assert.deepEqual(offresPertinentes(creme, 'Crème entière Bio Village 25cl', 'carrefour', ['Crème entière Bio Village 25cl']).map(x => x.rang), [0]);
});

test('des recherches plus courtes que le nom', () => {
  assert.deepEqual(recherchesPlusCourtes('Ail blanc 1p'), ['ail blanc', 'ail']);
  assert.deepEqual(recherchesPlusCourtes('Boulettes à la thaï CARREFOUR SENSATION'), ['boulettes thaï', 'boulettes']);
  assert.deepEqual(recherchesPlusCourtes('Gel WC Désinfectant Canard Action Intense Marine - 750ml'), ['gel wc désinfectant', 'gel wc', 'gel']);
});

test('la liste renvoyée ne porte que les remplacements, dans la quantité d’origine', () => {
  const r = { 'Ail blanc 1p': { product_id: 'p1', nom: 'Ail blanc filet', ean13: '123', prix: 1.2, image_url: null, grammage_g: 250, volume_ml: null, category: 'fruits_legumes' } };
  assert.deepEqual(itemsDesRemplacements(r, { 'Ail blanc 1p': { quantity: 2 } }), [{ name: 'Ail blanc filet', quantity: 2, unit: 'unité', ean13: '123', category: 'fruits_legumes', product_id: 'p1', grammage_g: 250, volume_ml: null }]);
  assert.deepEqual(itemsDesRemplacements(undefined, {}), []);
  // 2 crèmes de 25 cl remplacées par une de 50 cl : une seule ; par des 20 cl : trois.
  assert.equal(quantiteRemplacement({ quantity: 2, volume_ml: 250 }, { grammage_g: null, volume_ml: 500 }), 1);
  assert.equal(quantiteRemplacement({ quantity: 2, volume_ml: 250 }, { grammage_g: null, volume_ml: 200 }), 3);
  assert.equal(quantiteRemplacement({ quantity: 2, volume_ml: 250 }, { grammage_g: null, volume_ml: null }), 2);
});
