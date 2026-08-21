/**
 * Déduction du rayon depuis les catégories Open Food Facts.
 * Lancer : node --test mobile/lib/rayons.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rayonDepuisCategories, libelleRayon, RAYONS } from './rayons.ts';

// Étiquettes relevées sur l'API le 21/08/2026 pour les deux produits scannés.
const BOURSIN = [
  'en:dairies', 'en:fermented-foods', 'en:fermented-milk-products',
  'en:cheeses', 'en:cheeses-perishable',
];
const MENTHE = [
  'en:beverages-and-beverages-preparations', 'en:beverages',
  'en:beverage-preparations', 'en:syrups', 'en:flavoured-syrups', 'en:mint-syrups',
];

test('les deux produits scannés le 21/08 tombent dans le bon rayon', () => {
  assert.equal(rayonDepuisCategories(BOURSIN), 'pls');
  assert.equal(rayonDepuisCategories(MENTHE), 'boissons');
});

test("les surgelés l'emportent sur le contenu du paquet", () => {
  // Une pizza surgelée porte les deux étiquettes. Le rayon est un emplacement
  // physique : c'est le congélateur qui décide où on ira la chercher, pas la
  // pâte. Lire « l'étiquette la plus précise » l'enverrait en épicerie.
  assert.equal(rayonDepuisCategories(['en:pizzas', 'en:frozen-foods']), 'surgeles');
  assert.equal(rayonDepuisCategories(['en:ice-cream', 'en:desserts']), 'surgeles');
});

test('sans étiquette exploitable, le rayon est « autre »', () => {
  assert.equal(rayonDepuisCategories([]), 'autre');
  assert.equal(rayonDepuisCategories(undefined), 'autre');
  assert.equal(rayonDepuisCategories(null), 'autre');
});

test('des étiquettes sans correspondance tombent en épicerie', () => {
  // Open Food Facts ne référence que l'alimentaire : si on a des étiquettes
  // mais qu'aucune ne correspond, c'est un produit d'épicerie.
  assert.equal(rayonDepuisCategories(['en:snacks', 'en:sweet-snacks', 'en:biscuits']), 'epicerie');
});

test('les œufs suivent le rayon Carrefour, pas la convention', () => {
  // « Œufs Plein Air » est rangé en CHARCUT.TRAITEUR dans les 65 produits
  // migrés. Le rayon sert à retrouver le produit dans le drive : on suit le
  // magasin, pas un manuel de nutrition.
  assert.equal(rayonDepuisCategories(['en:eggs']), 'charcuterie');
});

test('libelleRayon rend un libellé affichable, jamais une clé', () => {
  assert.equal(libelleRayon('pls'), 'Produits laitiers');
  assert.equal(libelleRayon('boissons'), 'Boissons');
  assert.equal(libelleRayon('cle_inexistante'), 'Autres');
  assert.equal(libelleRayon(null), 'Autres');
  assert.equal(libelleRayon(undefined), 'Autres');
});

test("les 10 rayons suivent l'ordre d'affichage de la base", () => {
  assert.deepEqual(RAYONS.map((r) => r.cle), [
    'fruits_legumes', 'pls', 'charcuterie', 'boissons', 'epicerie',
    'droguerie', 'parfumerie', 'maison', 'surgeles', 'autre',
  ]);
});
