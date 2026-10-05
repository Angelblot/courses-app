import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyser, nomCourt, plusPetits } from './analyse-comparatif.ts';

const col = (nom, prix, prixUnite, extra = {}) => ({ nom, prix, prixUnite, nutriscore: null, nova: null, promotion: null, disponible: true, ...extra });

test('analyse : le moins cher à mesure égale, et de combien', () => {
  const p = analyser([col('CARREFOUR Papier cuisson 15 m CARREFOUR', 1.79, 0.119), col('Papier Repère 8 m', 1.39, 0.174), col('Albal 10 m', 1.95, 0.195)], 'm');
  assert.equal(p[0], 'Le moins cher au mètre : CARREFOUR Papier cuisson 15 m, 0,12 €/m, 39\u00a0% de moins que le plus cher.');
  // Le moins cher à l'achat n'est pas le moins cher au mètre : on le dit.
  assert.equal(p[1], 'Papier Repère 8 m coûte moins à l’achat, mais revient plus cher au mètre.');
});

test('analyse : sans mesure commune, le prix seul et une mise en garde', () => {
  const p = analyser([col('Papier 15 m', 1.79, null), col('Papier 20 feuilles', 0.99, null), col('Albal en feuilles', 1.95, null)], null);
  assert.deepEqual(p, ['Le moins cher à l’achat : Papier 20 feuilles, 0,99 €. Les quantités ne se comparent pas toutes : vérifie la contenance.']);
});

test('analyse : Nutri-Score, NOVA, promotion et indisponibilité quand ils départagent', () => {
  const p = analyser([col('Yaourt A', 2, 4, { nutriscore: 'a', nova: 1 }), col('Yaourt B', 2, 4, { nutriscore: 'c', nova: 4, promotion: '-30 % le 2e', disponible: false })], 'g');
  assert.deepEqual(p, ['Meilleur Nutri-Score : Yaourt A (A).', 'Le moins transformé : Yaourt A (NOVA 1).', 'En promotion : Yaourt B, -30\u00a0% le 2e.', 'Indisponible au drive : Yaourt B.']);
});

test('analyse : un prix estimé est dit, et la conversion expliquée', () => {
  const p = analyser([col('Papier cuisson 15 m', 1.79, 0.119), col('Papier 20 feuilles', 0.99, 0.118, { estime: true })], 'm');
  assert.equal(p[0], 'Le moins cher au mètre : Papier 20 feuilles, environ 0,12 €/m.');
  assert.equal(p[1], 'Pour les feuilles, les mètres sont estimés : leur grand côté mis bout à bout.');
});

test('analyse : utilitaires', () => {
  assert.deepEqual(plusPetits([3, null, 1, 1]), [2, 3]);
  assert.deepEqual(plusPetits([2, 2]), []);
  assert.deepEqual(plusPetits([2, null]), []);
  assert.equal(nomCourt('ALBAL Papier cuisson en feuilles ALBAL'), 'ALBAL Papier cuisson en feuilles');
});
