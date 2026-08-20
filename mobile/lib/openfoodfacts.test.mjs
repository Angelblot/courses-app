/**
 * Vérifie le mapping Open Food Facts, porté d'enrich_ean.py.
 * Ce sont des fonctions pures : aucun appel réseau ici.
 * Lancer : node --test mobile/lib/openfoodfacts.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapOffProduct, estLiquide } from './openfoodfacts.ts';

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
