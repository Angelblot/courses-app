/**
 * Déduction du rayon depuis les catégories Open Food Facts.
 * Lancer : node --test mobile/lib/rayons.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rayonDepuisCategories, rayonDepuisLibelle, libelleRayon, RAYONS } from './rayons.ts';

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

test('les libellés des ingrédients migrés se ramènent aux clés canoniques', () => {
  assert.equal(rayonDepuisLibelle('Produits laitiers'), 'pls');
  assert.equal(rayonDepuisLibelle('Fruits et légumes'), 'fruits_legumes');
  assert.equal(rayonDepuisLibelle('Épicerie'), 'epicerie');
  assert.equal(rayonDepuisLibelle('Charcuterie'), 'charcuterie');
});

test('« Boucherie » suit Carrefour et tombe en P.L.S.', () => {
  // Les 10 rayons viennent des sections du ticket Carrefour, où la boucherie
  // n'existe pas : « Filets de poulet jaune CARREFOUR » y est rangé en P.L.S.
  assert.equal(rayonDepuisLibelle('Boucherie'), 'pls');
});

test('la reconnaissance ignore casse, accents et esperluette', () => {
  assert.equal(rayonDepuisLibelle('FRUITS & LEGUMES'), 'fruits_legumes');
  assert.equal(rayonDepuisLibelle('epicerie'), 'epicerie');
  assert.equal(rayonDepuisLibelle('Charcuterie & traiteur'), 'charcuterie');
});

test('un libellé inconnu ou absent tombe en « autre »', () => {
  assert.equal(rayonDepuisLibelle('Cave à vin'), 'autre');
  assert.equal(rayonDepuisLibelle(''), 'autre');
  assert.equal(rayonDepuisLibelle(null), 'autre');
});

test('une clé canonique passée par mégarde est rendue telle quelle', () => {
  // Le récapitulatif mélange des ingrédients (libellés) et des produits (clés).
  assert.equal(rayonDepuisLibelle('pls'), 'pls');
  assert.equal(rayonDepuisLibelle('fruits_legumes'), 'fruits_legumes');
});

// --- Étiquettes parapluies d'Open Food Facts ---

test("« plant-based-foods-and-beverages » n'envoie pas tout aux boissons", () => {
  // Constaté le 24/08 : cette étiquette coiffe la quasi-totalité de
  // l'alimentaire végétal, et son suffixe « beverages » correspondait à la
  // règle des boissons. Chapelure, croûtons, thym et pain s'y retrouvaient.
  // Étiquettes réelles d'une chapelure.
  assert.equal(rayonDepuisCategories([
    'en:plant-based-foods-and-beverages', 'en:plant-based-foods',
    'en:cereals-and-potatoes', 'en:cereals-and-their-products',
    'en:breads', 'en:bread-crumbs', 'en:groceries',
  ]), 'epicerie');
});

test('une vraie boisson reste aux boissons', () => {
  assert.equal(rayonDepuisCategories([
    'en:plant-based-foods-and-beverages', 'en:beverages', 'en:waters',
  ]), 'boissons');
  assert.equal(rayonDepuisCategories(['en:mint-syrups']), 'boissons');
});

test("les étiquettes parapluies seules ne classent rien de précis", () => {
  // Il en reste une information : Open Food Facts ne référence que
  // l'alimentaire, donc c'est de l'épicerie.
  assert.equal(rayonDepuisCategories(['en:plant-based-foods-and-beverages']), 'epicerie');
  assert.equal(rayonDepuisCategories(['en:groceries', 'en:foods']), 'epicerie');
});

test('un légume frais garde son rayon malgré le parapluie', () => {
  assert.equal(rayonDepuisCategories([
    'en:plant-based-foods-and-beverages', 'en:plant-based-foods',
    'en:vegetables-based-foods', 'en:fresh-vegetables',
  ]), 'fruits_legumes');
});
