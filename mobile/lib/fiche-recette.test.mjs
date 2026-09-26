/**
 * Lecture de la réponse de la fonction Edge `lire-fiche`. Fonctions pures.
 * Lancer : node --test mobile/lib/fiche-recette.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireFiche } from './fiche-recette.ts';
import { analyserLigne } from './import-recette.ts';

// La forme attendue pour la fiche HelloFresh « dinde & crema de coriandre »
// (semaine 04/2026) : 2 personnes, dix ingrédients livrés, quatre du placard.
const HELLOFRESH = {
  lisible: true,
  nom: 'Dinde rôtie, pommes de terre et crema de coriandre',
  parts: 2,
  ingredients: [
    '1 oignon',
    "1 gousse d'ail",
    '500 g de pommes de terre',
    '1/2 sachet de paprika fumé en poudre',
    '1 paquet de dés de filet de dinde',
    '1 sachet de coriandre',
    "1 sachet d'aïoli",
    '1 pot de yaourt à la grecque',
    '1 sucrine',
    '1 avocat',
    '1 cuillère à café de sucre',
    '3 cuillères à café de vinaigre de vin rouge',
    "2 cuillères à soupe d'huile d'olive",
    'sel',
    'poivre',
  ],
};

test('une fiche lisible devient une recette importée', () => {
  const r = lireFiche(HELLOFRESH);
  assert.equal(r?.nom, 'Dinde rôtie, pommes de terre et crema de coriandre');
  assert.equal(r?.parts, 2);
  assert.equal(r?.ingredients.length, 15);
  // Une photo de papier n'est pas une photo de plat : pas d'image de couverture.
  assert.equal(r?.image, null);
  assert.equal(r?.preparationMin, null);
});

test("les lignes rendues passent par l'analyseur de l'import par lien", () => {
  const lignes = lireFiche(HELLOFRESH).ingredients.map(analyserLigne);
  assert.deepEqual(lignes[2], { quantite: 500, unite: 'g', nom: 'pommes de terre', aVerifier: false });
  assert.deepEqual(lignes[3], { quantite: 0.5, unite: 'sachet', nom: 'paprika fumé en poudre', aVerifier: false });
  assert.deepEqual(lignes[1], { quantite: 1, unite: 'gousse', nom: 'ail', aVerifier: false });
  assert.deepEqual(lignes[12], { quantite: 2, unite: 'cuillère à soupe', nom: "huile d'olive", aVerifier: false });
  // « Selon votre goût » reste sans quantité : c'est à l'utilisateur de trancher.
  assert.equal(lignes[13].aVerifier, true);
});

test('une photo sans recette est refusée', () => {
  assert.equal(lireFiche({ lisible: false, nom: '', parts: 0, ingredients: [] }), null);
});

test('une fiche sans ingrédient est refusée', () => {
  assert.equal(lireFiche({ ...HELLOFRESH, ingredients: ['  ', ''] }), null);
});

test('un nombre de parts absent ou absurde retombe à 4', () => {
  assert.equal(lireFiche({ ...HELLOFRESH, parts: 0 })?.parts, 4);
  assert.equal(lireFiche({ ...HELLOFRESH, parts: '2 personnes' })?.parts, 2);
});

test('un nom vide est remplacé plutôt que de bloquer l’enregistrement', () => {
  assert.equal(lireFiche({ ...HELLOFRESH, nom: '  ' })?.nom, 'Recette photographiée');
});

test('une réponse malformée rend null sans lever', () => {
  assert.equal(lireFiche(null), null);
  assert.equal(lireFiche('texte'), null);
  assert.equal(lireFiche({ lisible: true, nom: 'X', parts: 2, ingredients: 'oignon' }), null);
});

test('les lignes non textuelles sont ignorées', () => {
  const r = lireFiche({ ...HELLOFRESH, ingredients: ['1 oignon', 42, null, ' 1 avocat '] });
  assert.deepEqual(r?.ingredients, ['1 oignon', '1 avocat']);
});
