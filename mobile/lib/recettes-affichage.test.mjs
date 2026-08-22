/**
 * Calculs d'affichage des recettes. Fonctions pures, sans réseau ni React.
 * Lancer : node --test mobile/lib/recettes-affichage.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  quantitePourParts, initiale, indiceAplat, filtrerCatalogue,
} from './recettes-affichage.ts';

test('la quantité suit le nombre de parts', () => {
  assert.equal(quantitePourParts(50, 4), 200);
  assert.equal(quantitePourParts(50, 1), 50);
  assert.equal(quantitePourParts(0, 4), 0);
});

test("un nombre de parts absurde ne produit pas de quantité absurde", () => {
  assert.equal(quantitePourParts(50, 0), 0);
  assert.equal(quantitePourParts(50, -3), 0);
});

test("l'initiale est la première lettre, en majuscule", () => {
  assert.equal(initiale('gratin dauphinois'), 'G');
  assert.equal(initiale('  Salade César'), 'S');
  assert.equal(initiale('Œufs mimosa'), 'Œ');
});

test("un nom vide donne une initiale neutre plutôt qu'une erreur", () => {
  assert.equal(initiale(''), '?');
  assert.equal(initiale('   '), '?');
});

test("la couleur d'aplat est stable pour un même nom", () => {
  // Elle n'est pas stockée : elle doit se redériver identique à chaque rendu,
  // sinon la liste scintillerait d'un affichage à l'autre.
  assert.equal(indiceAplat('Gratin dauphinois'), indiceAplat('Gratin dauphinois'));
});

test("la couleur d'aplat reste dans la palette", () => {
  for (const nom of ['A', 'Gratin', 'Salade César', '', 'Œufs']) {
    const i = indiceAplat(nom);
    assert.ok(Number.isInteger(i) && i >= 0 && i < 6, `hors palette pour ${nom} : ${i}`);
  }
});

test('le filtrage ignore la casse et les accents', () => {
  const produits = [
    { name: 'Crème Fraîche Épaisse', brand: 'CARREFOUR' },
    { name: 'Spaghetti n°5', brand: null },
  ];
  assert.equal(filtrerCatalogue(produits, 'creme').length, 1);
  assert.equal(filtrerCatalogue(produits, 'CRÈME').length, 1);
  assert.equal(filtrerCatalogue(produits, 'fraiche epaisse').length, 1);
});

test('le filtrage porte aussi sur la marque', () => {
  const produits = [{ name: 'Lait demi-écrémé', brand: 'CARREFOUR' }];
  assert.equal(filtrerCatalogue(produits, 'carrefour').length, 1);
});

test('une requête vide ou trop courte ne filtre rien', () => {
  const produits = [{ name: 'A', brand: null }, { name: 'B', brand: null }];
  assert.equal(filtrerCatalogue(produits, '').length, 2);
  assert.equal(filtrerCatalogue(produits, '  ').length, 2);
});

test('une requête sans correspondance rend une liste vide, pas tout le catalogue', () => {
  const produits = [{ name: 'Lait', brand: null }];
  assert.equal(filtrerCatalogue(produits, 'perlimpinpin').length, 0);
});
