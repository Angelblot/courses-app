import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireArticles, quantiteEtNom, importerRappels, annulerReprise } from './rappels.ts';
import { rattacherSiri } from './widget-products.ts';

const vide = { ligneQuantites: {}, lignePossedees: {}, selectedRecipes: {}, quotidien: {}, quotidienQty: {}, extras: [], choixProduits: {}, drives: ['carrefour'] };

test('articles Rappels : titres vides ou trop longs écartés', () => {
 assert.deepEqual(lireArticles([{ id: 'a', titre: ' Crème fraîche ' }, { id: 'b', titre: '  ' }, { id: 'c', titre: 'x'.repeat(121) }, null, { titre: 'sans id' }]),
  [{ id: 'a', titre: 'Crème fraîche' }]);
 assert.deepEqual(lireArticles('pas une liste'), []);
});

test('quantité notée dans le titre', () => {
 assert.deepEqual(quantiteEtNom('2 laits'), { name: 'laits', quantity: 2 });
 assert.deepEqual(quantiteEtNom('Lait x3'), { name: 'Lait', quantity: 3 });
 assert.deepEqual(quantiteEtNom('Œufs (12)'), { name: 'Œufs', quantity: 12 });
 assert.deepEqual(quantiteEtNom('Crème fraîche'), { name: 'Crème fraîche', quantity: 1 });
 assert.deepEqual(quantiteEtNom('7up'), { name: '7up', quantity: 1 });
});

test('reprise : une seule fois par article, source Rappels, puis rattachée au produit', () => {
 const articles = [{ id: 'r1', titre: 'Crème fraîche' }, { id: 'r2', titre: '2 laits' }];
 const e1 = importerRappels(vide, 'Achats Courses', articles);
 assert.equal(e1.extras.length, 2);
 assert.deepEqual(e1.manques['extra:rappel-r1'], { name: 'Crème fraîche', source: 'rappels', valide: false });
 assert.deepEqual(e1.derniereReprise, { liste: 'Achats Courses', ids: ['r1', 'r2'], cles: ['extra:rappel-r1', 'extra:rappel-r2'] });
 assert.equal(importerRappels(e1, 'Achats Courses', articles), e1);
 const lait = { id: 'lait', name: 'Lait demi-écrémé', brand: null, product_type: 'lait' };
 const e2 = rattacherSiri(e1, [lait]);
 assert.deepEqual(e2.manques['produit:lait'], { name: 'Lait demi-écrémé', source: 'rappels', valide: false });
 assert.equal(e2.quotidienQty.lait, 2);
 assert.deepEqual(e2.derniereReprise.cles, ['extra:rappel-r1', 'produit:lait']);
 const e3 = annulerReprise(e2);
 assert.deepEqual(Object.keys(e3.manques), []);
 assert.equal(e3.quotidien.lait, undefined);
 assert.deepEqual(e3.extras, []);
 assert.equal(importerRappels(e3, 'Achats Courses', articles), e3);
});
