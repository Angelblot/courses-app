/** Lancer : node --test extension/departage.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { departager } from './lib/departage.js';

const c = (...labels) => labels.map((label, i) => ({ label, score: 1 - i * 0.01 }));

test('le libellé exact tranche', () => {
  assert.deepEqual(departager({ name: 'Crème entière fluide UHT Bio Bio Village 30% MG - 25cl' },
    c('Crème entière fluide UHT Bio\nBio Village 30% MG - 25cl', 'Crème entière fluide UHT Bio\nBio Village 30% MG - 3x20cl')),
    { label: 'Crème entière fluide UHT Bio\nBio Village 30% MG - 25cl', raison: 'libelle' });
});

test('le format de la référence tranche', () => {
  const r = departager({ name: 'Essuie-tout blanc Mimosa Super absorbant - x3 compacts' },
    c('Essuie-tout blanc Mimosa\nSuper absorbant - x4 compacts', 'Essuie-tout blanc Mimosa Super absorbant x3 compacts', 'Essuie-tout blanc Mimosa\nSuper absorbant - x6'));
  assert.equal(r?.raison, 'format');
  assert.match(r.label, /x3/);
  // Contenance connue de la référence : 620 g parmi 1 kg, 620 g, 410 g.
  assert.deepEqual(departager({ name: 'Céréales Trésor Chocolat au Lait', grammage_g: 620 },
    c('Céréales Trésor Kellogg\'s\nChocolat au lait - 1kg', 'Céréales Trésor Kellogg\'s\nChocolat au lait - 620g', 'Céréales Trésor de Kellogg\'s\nChocolat au Lait - 410g')),
    { label: 'Céréales Trésor Kellogg\'s\nChocolat au lait - 620g', raison: 'format' });
});

test('les cas du 09/10 chez E.Leclerc', () => {
  assert.match(departager({ name: 'Jambon Simplement Bon FLEURY MICHON', grammage_g: 160 }, c('Jambon Simplement Bon Fleury\nMichon x4 - 160g', 'Jambon Simplement Bon Fleury\nMichon - x6 - 240g', 'Jambon Simplement Bon\nFleury Michon - x8 - 320g'))?.label ?? '', /160g/);
  assert.match(departager({ name: 'Sauce soja salée SUZI WAN', volume_ml: 250 }, c('Sauce soja Suzi Wan\n250ml', 'Sauce soja Suzi Wan\n135ml', 'Sauce soja Suzi Wan\nSucrée - 135ml'))?.label ?? '', /250ml/);
  assert.match(departager({ name: 'Lait bio Bio Village Bouteille Demi-écrémé UHT - 1L', volume_ml: 1000 }, c('Lait bio Bio Village Bouteille\nDemi-écrémé UHT - 1L', 'Lait bio Bio Village Bouteille\nDemi-écrémé UHT - 6x1L'))?.label ?? '', /- 1L$/);
  assert.equal(departager({ name: 'Céréales Trésor Chocolat au Lait', grammage_g: 500 }, c('Céréales Trésor Kellogg\'s\nChocolat au lait - 1kg', 'Céréales Trésor Kellogg\'s\nChocolat au lait - 620g')), null);
});

test('sinon, on laisse choisir', () => {
  // Rien pour départager trois formats.
  assert.equal(departager({ name: 'Céréales Trésor Chocolat au Lait' }, c('Trésor 1kg', 'Trésor 620g', 'Trésor 410g')), null);
  // Le même poids chez une autre marque ne suffit pas : c'est un autre produit.
  assert.equal(departager({ name: 'Fromage Cheddar LE CENTURION', grammage_g: 200 }, c('Fromage râpé Cheddar\nKraft - 150g', 'Cheddar fromage râpé\nLes Croisés - 200g', 'Fromage burger cheddar Kraft\n7 tranches 175g')), null);
  // Trois fromages différents : c'est à l'humain.
  assert.equal(departager({ name: 'Fromage Cheddar LE CENTURION' }, c('Fromage râpé Cheddar\nKraft - 150g', 'Cheddar fromage râpé\nLes Croisés - 200g', 'Fromage burger cheddar Kraft\n7 tranches 175g')), null);
  // Deux candidats au même format : on ne choisit pas au hasard.
  assert.equal(departager({ name: 'Lait 1L' }, c('Lait demi-écrémé 1L', 'Lait entier 1L')), null);
});
