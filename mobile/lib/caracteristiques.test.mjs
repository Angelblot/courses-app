import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireMesures, uniteCommune, prixParUnite, prixUnitaireLisible, contenanceLisible, libellePrixUnitaire } from './caracteristiques.ts';

test('mesures : longueurs, feuilles et lots lus dans le libellé', () => {
  assert.deepEqual(lireMesures('CARREFOUR Papier cuisson 15 m CARREFOUR'), { m: 15 });
  assert.deepEqual(lireMesures('CARREFOUR Papier cuisson 20 feuilles CARREFOUR'), { feuille: 20 });
  assert.deepEqual(lireMesures('Papier cuisson 8 m x 38 cm'), { m: 8 });
  assert.deepEqual(lireMesures('Papier cuisson 2,5 mètres'), { m: 2.5 });
  assert.deepEqual(lireMesures('Allumettes 2x75g'), { g: 150 });
  assert.deepEqual(lireMesures('Lait demi-écrémé 6 x 1 L'), { ml: 6000 });
  assert.deepEqual(lireMesures('Beurre doux 250 g'), { g: 250 });
  assert.deepEqual(lireMesures('Café 1kg'), { g: 1000 });
  assert.deepEqual(lireMesures('Lessive liquide 40 lavages 1,8 L'), { ml: 1800, lavage: 40 });
  assert.deepEqual(lireMesures('Tablettes lave-vaisselle x30'), { piece: 30 });
  assert.deepEqual(lireMesures('Capsules café 4 x 10 capsules'), { dose: 40 });
  assert.deepEqual(lireMesures('Papier toilette 12 rouleaux'), { rouleau: 12 });
  assert.deepEqual(lireMesures('Lot de 3 éponges'), { piece: 3 });
  assert.deepEqual(lireMesures('ALBAL Papier cuisson en feuilles ALBAL'), {});
});

test('mesures : la mesure commune est celle que partagent le plus de produits', () => {
  assert.equal(uniteCommune([{ m: 15 }, { feuille: 20 }, { m: 8 }]), 'm');
  assert.equal(uniteCommune([{ ml: 1800, lavage: 40 }, { lavage: 30 }, { ml: 2000 }]), 'lavage');
  assert.equal(uniteCommune([{ m: 15 }, { feuille: 20 }]), null);
  assert.equal(uniteCommune([{}, {}]), null);
});

test('mesures : prix comparables et lisibles', () => {
  assert.equal(prixParUnite(1.79, { m: 15 }, 'm'), 0.119);
  assert.equal(prixUnitaireLisible(0.119, 'm'), '0,12 €/m');
  // Sous 10 centimes, trois décimales départagent une feuille d'une autre.
  assert.equal(prixUnitaireLisible(prixParUnite(0.99, { feuille: 20 }, 'feuille'), 'feuille'), '0,050 €/feuille');
  assert.equal(prixParUnite(2.5, { g: 250 }, 'g'), 10);
  assert.equal(prixUnitaireLisible(10, 'g'), '10,00 €/kg');
  assert.equal(prixParUnite(1.5, { ml: 1500 }, 'ml'), 1);
  assert.equal(prixParUnite(null, { m: 15 }, 'm'), null);
  assert.equal(prixParUnite(1.2, { feuille: 20 }, 'm'), null);
  assert.equal(contenanceLisible('g', 1500), '1,5 kg');
  assert.equal(contenanceLisible('feuille', 1), '1 feuille');
  assert.equal(libellePrixUnitaire('lavage'), 'Prix au lavage');
});
