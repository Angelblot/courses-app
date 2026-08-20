/**
 * Vérifie le mapping Open Food Facts, porté d'enrich_ean.py.
 * Ce sont des fonctions pures : aucun appel réseau ici.
 * Lancer : node --test mobile/lib/openfoodfacts.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapOffProduct, estLiquide, echappe } from './openfoodfacts.ts';

test('un solide reçoit un grammage', () => {
  const fiche = mapOffProduct('3760040427577', {
    product_name: 'Lardons fumés',
    brands: 'Herta',
    product_quantity: 200,
    image_url: 'https://exemple.test/i.jpg',
  });
  assert.equal(fiche.grammageG, 200);
  assert.equal(fiche.volumeMl, null);
  assert.equal(fiche.brand, 'Herta');
  assert.equal(fiche.productType, 'lardon');
});

test('un liquide reçoit un volume', () => {
  const fiche = mapOffProduct('123', {
    product_name: 'Lait demi-écrémé',
    product_quantity: 1000,
  });
  assert.equal(fiche.volumeMl, 1000);
  assert.equal(fiche.grammageG, null);
});

test('la catégorie Open Food Facts sert aussi à détecter un liquide', () => {
  assert.equal(estLiquide('Tropicana', ['en:beverages']), true);
});

test('une quantité absente ne bloque pas la fiche', () => {
  // Le produit reste ajoutable : la contenance se saisit à la main ensuite.
  const fiche = mapOffProduct('123', { product_name: 'Pain de mie' });
  assert.equal(fiche.grammageG, null);
  assert.equal(fiche.volumeMl, null);
  assert.equal(fiche.name, 'Pain de mie');
});

test('une quantité aberrante est ignorée', () => {
  const fiche = mapOffProduct('123', { product_name: 'Riz', product_quantity: -5 });
  assert.equal(fiche.grammageG, null);
});

test('une fiche sans nom est refusée', () => {
  // Sans nom, le produit serait inexploitable dans le catalogue.
  assert.equal(mapOffProduct('123', { product_name: '' }), null);
  assert.equal(mapOffProduct('123', {}), null);
});

test('la marque prend la première quand Open Food Facts en liste plusieurs', () => {
  const fiche = mapOffProduct('123', { product_name: 'Yaourt', brands: 'Danone,Activia' });
  assert.equal(fiche.brand, 'Danone');
});

test('une virgule de tête ne doit pas donner une marque vide', () => {
  // Open Food Facts renvoie parfois une liste avec une entrée vide en tête.
  const fiche = mapOffProduct('123', { product_name: 'Yaourt', brands: ', Danone' });
  assert.equal(fiche.brand, 'Danone');
});

test('une fiche sans nom donne un résultat inconnu, pas une fiche exploitable', () => {
  // mapOffProduct renvoie null : c'est ce que lookupEan doit traduire en
  // `{ etat: 'inconnu' }`, testé ici au niveau du mapping qui porte la règle.
  assert.equal(mapOffProduct('123', { product_name: '   ' }), null);
});

test('un mot-clé de liquide contenant un métacaractère ne casse pas la détection', () => {
  // Aucun des seize mots-clés actuels de MOTS_LIQUIDES n'a de métacaractère,
  // donc estLiquide() seul ne peut pas démontrer la régression corrigée. On
  // teste directement echappe() avec un mot-clé hypothétique contenant une
  // parenthèse : sans échappement, `new RegExp` lèverait une SyntaxError.
  const motCle = 'sauce(maison)';
  assert.doesNotThrow(() => new RegExp(`(^|\\s)${echappe(motCle)}`));
  assert.equal(new RegExp(`(^|\\s)${echappe(motCle)}`).test('la sauce(maison) du chef'), true);
});
