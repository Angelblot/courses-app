/**
 * Analyse d'une recette importée. Fonctions pures, sans réseau.
 * Lancer : node --test mobile/lib/import-recette.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyserLigne, lireParts, extraireRecette } from './import-recette.ts';

// Lignes réellement rendues par Marmiton, mesurées le 22/08.
test('une quantité, une unité connue, un nom', () => {
  assert.deepEqual(analyserLigne('600 g de bourguignon'),
    { quantite: 600, unite: 'g', nom: 'bourguignon', aVerifier: false });
});

test('une unité inconnue est retenue quand elle précède « de »', () => {
  assert.deepEqual(analyserLigne('1 bouteille de vin rouge assez bon'),
    { quantite: 1, unite: 'bouteille', nom: 'vin rouge assez bon', aVerifier: false });
});

test('sans unité, la quantité compte des exemplaires', () => {
  assert.deepEqual(analyserLigne('4 oignons'),
    { quantite: 4, unite: 'unité', nom: 'oignons', aVerifier: false });
});

test('un mot seul après le nombre ne devient pas une unité', () => {
  // Sans la règle du « de », « bouquet » deviendrait l'unité et le nom serait
  // vide.
  assert.deepEqual(analyserLigne('1 bouquet garni'),
    { quantite: 1, unite: 'unité', nom: 'bouquet garni', aVerifier: false });
});

test('une ligne sans quantité est signalée, jamais inventée', () => {
  assert.deepEqual(analyserLigne('sel'),
    { quantite: 0, unite: 'unité', nom: 'sel', aVerifier: true });
  assert.equal(analyserLigne('poivre').aVerifier, true);
});

test("l'élision est retirée du nom", () => {
  const r = analyserLigne("2 cuillères à soupe d'huile d'olive");
  assert.equal(r.quantite, 2);
  assert.equal(r.unite, 'cuillère à soupe');
  assert.equal(r.nom, "huile d'olive");
});

test('les fractions et les décimales à la française sont comprises', () => {
  assert.equal(analyserLigne('1/2 citron').quantite, 0.5);
  assert.equal(analyserLigne('1,5 kg de pommes de terre').quantite, 1.5);
  assert.equal(analyserLigne('1.5 kg de pommes de terre').quantite, 1.5);
});

test('une ligne vide ne produit pas un ingrédient fantôme', () => {
  assert.equal(analyserLigne('').nom, '');
  assert.equal(analyserLigne('   ').aVerifier, true);
});

test('le nombre de parts se lit sous toutes ses formes', () => {
  assert.equal(lireParts('4 personnes'), 4);
  assert.equal(lireParts(6), 6);
  assert.equal(lireParts(['8 parts']), 8);
  assert.equal(lireParts('pour 2 gourmands'), 2);
});

test('un nombre de parts illisible retombe sur 4', () => {
  // Inventer 1 ferait des quantités quatre fois trop petites sans que rien ne
  // le signale.
  assert.equal(lireParts(null), 4);
  assert.equal(lireParts('quelques'), 4);
  assert.equal(lireParts(0), 4);
});

const BLOC_SIMPLE = JSON.stringify({
  '@type': 'Recipe',
  name: 'Gratin',
  recipeYield: '4 personnes',
  image: 'https://exemple.test/g.jpg',
  recipeIngredient: ['600 g de pommes de terre', 'sel'],
});

test('la recette se trouve dans un bloc simple', () => {
  const r = extraireRecette([BLOC_SIMPLE]);
  assert.equal(r.nom, 'Gratin');
  assert.equal(r.parts, 4);
  assert.equal(r.image, 'https://exemple.test/g.jpg');
  assert.equal(r.ingredients.length, 2);
});

test('la recette se trouve dans un tableau', () => {
  const r = extraireRecette([JSON.stringify([{ '@type': 'WebPage' }, JSON.parse(BLOC_SIMPLE)])]);
  assert.equal(r.nom, 'Gratin');
});

test('la recette se trouve dans un @graph', () => {
  const r = extraireRecette([JSON.stringify({ '@graph': [JSON.parse(BLOC_SIMPLE)] })]);
  assert.equal(r.nom, 'Gratin');
});

test('un bloc malformé est ignoré, pas fatal', () => {
  const r = extraireRecette(['{ pas du json', BLOC_SIMPLE]);
  assert.equal(r.nom, 'Gratin');
});

test("l'absence de recette se dit, elle ne s'invente pas", () => {
  assert.equal(extraireRecette([]), null);
  assert.equal(extraireRecette([JSON.stringify({ '@type': 'Article' })]), null);
  assert.equal(extraireRecette(['{ cassé']), null);
});

test("l'image peut être un objet ou un tableau", () => {
  const avecObjet = extraireRecette([JSON.stringify({
    '@type': 'Recipe', name: 'X', recipeIngredient: ['sel'],
    image: { url: 'https://exemple.test/o.jpg' },
  })]);
  assert.equal(avecObjet.image, 'https://exemple.test/o.jpg');

  const avecTableau = extraireRecette([JSON.stringify({
    '@type': 'Recipe', name: 'X', recipeIngredient: ['sel'],
    image: ['https://exemple.test/t.jpg'],
  })]);
  assert.equal(avecTableau.image, 'https://exemple.test/t.jpg');
});
