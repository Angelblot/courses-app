/**
 * Organisation du catalogue : filtre, tri, regroupement. Fonctions pures.
 * Lancer : node --test mobile/lib/catalogue.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { organiserCatalogue, TRIS } from './catalogue.ts';

const P = (name, category, favorite = false, brand = null) =>
  ({ id: name, name, category, favorite, brand });

const CATALOGUE = [
  P('Œufs Plein Air', 'charcuterie'),
  P('Avocat', 'fruits_legumes', true),
  P('Éclair au chocolat', 'epicerie'),
  P('Lait Demi-Écrémé', 'pls', true),
  P('Bière Blonde', 'boissons'),
  P('Zeste de citron', 'fruits_legumes'),
];

test('les trois tris sont proposés, dans un ordre stable', () => {
  assert.deepEqual(TRIS.map((t) => t.cle), ['rayon', 'nom', 'favoris']);
});

test('le tri par nom ignore accents et casse', () => {
  // Sans normalisation, « Œufs » et « Éclair » se retrouvent après « Zeste »,
  // parce que leurs codes sont plus grands que ceux des lettres latines.
  const [section] = organiserCatalogue(CATALOGUE, '', 'nom');
  assert.deepEqual(section.produits.map((p) => p.name), [
    'Avocat', 'Bière Blonde', 'Éclair au chocolat',
    'Lait Demi-Écrémé', 'Œufs Plein Air', 'Zeste de citron',
  ]);
});

test('le tri par nom ne fait qu’une seule section', () => {
  const sections = organiserCatalogue(CATALOGUE, '', 'nom');
  assert.equal(sections.length, 1);
  assert.equal(sections[0].titre, null);
});

test('le regroupement par rayon suit l’ordre des rayons, pas l’alphabet', () => {
  // « Fruits & légumes » précède « Produits laitiers » dans le magasin, et
  // c'est cet ordre-là qui compte : la liste sert à faire les courses.
  const sections = organiserCatalogue(CATALOGUE, '', 'rayon');
  assert.deepEqual(sections.map((s) => s.titre),
    ['Fruits & légumes', 'Produits laitiers', 'Charcuterie & traiteur', 'Boissons', 'Épicerie']);
});

test('un rayon vide ne laisse pas de section', () => {
  const sections = organiserCatalogue([P('Avocat', 'fruits_legumes')], '', 'rayon');
  assert.equal(sections.length, 1);
  assert.equal(sections[0].titre, 'Fruits & légumes');
});

test('les favoris remontent en tête, dans leur propre section', () => {
  const sections = organiserCatalogue(CATALOGUE, '', 'favoris');
  assert.deepEqual(sections.map((s) => s.titre), ['Favoris', 'Le reste']);
  assert.deepEqual(sections[0].produits.map((p) => p.name), ['Avocat', 'Lait Demi-Écrémé']);
  assert.equal(sections[1].produits.length, 4);
});

test('sans aucun favori, la section « Favoris » disparaît', () => {
  const sections = organiserCatalogue([P('Avocat', 'fruits_legumes')], '', 'favoris');
  assert.deepEqual(sections.map((s) => s.titre), ['Le reste']);
});

test('la recherche s’applique avant le regroupement', () => {
  const sections = organiserCatalogue(CATALOGUE, 'lait', 'rayon');
  assert.deepEqual(sections.map((s) => s.titre), ['Produits laitiers']);
  assert.equal(sections[0].produits.length, 1);
});

test('une recherche sans résultat rend zéro section, pas une section vide', () => {
  // Une section vide afficherait un titre de rayon sous lequel il n'y a rien.
  assert.deepEqual(organiserCatalogue(CATALOGUE, 'perlimpinpin', 'rayon'), []);
  assert.deepEqual(organiserCatalogue(CATALOGUE, 'perlimpinpin', 'nom'), []);
});

test('un catalogue vide ne produit aucune section', () => {
  for (const tri of ['nom', 'rayon', 'favoris']) {
    assert.deepEqual(organiserCatalogue([], '', tri), [], `échoue pour ${tri}`);
  }
});
