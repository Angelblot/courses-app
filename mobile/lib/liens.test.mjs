import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etatDrive, categorieLiens, resumeLiens, courtLiens, indexerFaits } from './liens.ts';
import { separerAilleurs } from './consolidation.ts';

const p = (x) => ({ id: 'p', name: 'Mortadelle', brand: 'Negroni', product_type: 'charcuterie', ...x });
const faits = indexerFaits(
  [{ product_id: 'p', drive: 'carrefour' }, { product_id: 'q', drive: 'leclerc' }, { product_id: 'q', drive: 'leclerc' }, { product_id: null, drive: 'carrefour' }],
  [{ product_id: 'p', drive: 'leclerc', unavailable: true }, { product_id: 'r', drive: 'leclerc', unavailable: false }, { product_id: 'q', drive: 'leclerc', unavailable: true }],
);

test('relié, absent ou sans lien, drive par drive', () => {
  assert.equal(etatDrive(p(), 'carrefour', faits.get('p')), 'relie');
  assert.equal(etatDrive(p(), 'leclerc', faits.get('p')), 'absent');
  assert.equal(etatDrive(p({ id: 'z' }), 'leclerc', faits.get('z')), 'aucun');
  // Une fiche mémorisée vaut lien.
  assert.equal(etatDrive(p({ id: 'r' }), 'leclerc', faits.get('r')), 'relie');
});

test('un achat l’emporte sur un vieux « absent »', () => {
  assert.equal(etatDrive(p({ id: 'q' }), 'leclerc', faits.get('q')), 'relie');
});

test('réservé à un drive ou acheté ailleurs : l’autre drive est sans objet', () => {
  assert.equal(etatDrive(p({ vendu_chez: 'leclerc' }), 'carrefour', undefined), 'hors');
  assert.equal(etatDrive(p({ vendu_chez: 'ailleurs' }), 'carrefour', faits.get('p')), 'hors');
});

test('catégorie du récapitulatif', () => {
  assert.equal(categorieLiens(p(), faits.get('p')), 'carrefour');
  assert.equal(categorieLiens(p({ id: 'z' }), undefined), 'aucun');
  assert.equal(categorieLiens(p({ id: 'q', vendu_chez: 'leclerc' }), faits.get('q')), 'deux');
  assert.equal(categorieLiens(p({ vendu_chez: 'ailleurs' }), faits.get('p')), 'ailleurs');
  const deux = indexerFaits([{ product_id: 'p', drive: 'carrefour' }, { product_id: 'p', drive: 'leclerc' }], []);
  assert.equal(categorieLiens(p(), deux.get('p')), 'deux');
});

test('le résumé de la fiche', () => {
  assert.equal(resumeLiens(p(), faits.get('p')), 'Carrefour : relié · E.Leclerc : absent');
  assert.equal(resumeLiens(p({ id: 'z', vendu_chez: 'carrefour' }), undefined), 'Carrefour : pas de lien');
  assert.equal(resumeLiens(p({ vendu_chez: 'ailleurs' }), undefined), 'Acheté hors drive');
  assert.equal(courtLiens(p(), faits.get('p')), 'Carrefour');
  assert.equal(courtLiens(p({ id: 'z' }), undefined), '');
});

test('ce qui s’achète ailleurs ne part pas au drive', () => {
  const produits = [p({ id: 'avocat', vendu_chez: 'ailleurs' }), p({ id: 'lait' })];
  const r = separerAilleurs([{ product_id: 'avocat' }, { product_id: 'lait' }, { product_id: null }], produits);
  assert.deepEqual(r.ailleurs.map(l => l.product_id), ['avocat']);
  assert.deepEqual(r.drive.map(l => l.product_id), ['lait', null]);
});
