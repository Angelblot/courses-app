import { test } from 'node:test';
import assert from 'node:assert/strict';
import { champsModifies, differencesOff, formaterContenance, fusionnerManuels, lireContenance, patchDepuisOff, pertesSuppression } from './fiche-produit.ts';

const produit = { name: 'Allumettes nature sans nitrite CARREFOUR', brand: null, grammage_g: 200, volume_ml: null, category: 'charcuterie', nutriscore: 'b', image_url: 'https://images.openfoodfacts.org/a.jpg', champs_manuels: [], image_originale: null };
const off = { ean13: '3245414146938', name: 'Allumettes nature sans nitrite', brand: 'Carrefour', imageUrl: 'https://images.openfoodfacts.org/b.jpg', grammageG: 150, volumeMl: null, productType: null, categoryKey: 'charcuterie', nutriscore: 'b' };

test('lireContenance : grammes, litres, centilitres, virgule française', () => {
  assert.deepEqual(lireContenance('150 g'), { grammage_g: 150, volume_ml: null });
  assert.deepEqual(lireContenance('1,5 L'), { grammage_g: null, volume_ml: 1500 });
  assert.deepEqual(lireContenance('75cl'), { grammage_g: null, volume_ml: 750 });
  assert.deepEqual(lireContenance('0.5 kg'), { grammage_g: 500, volume_ml: null });
  assert.deepEqual(lireContenance('  '), { grammage_g: null, volume_ml: null });
  assert.equal(lireContenance('un paquet'), null);
  assert.equal(lireContenance('0 g'), null);
});

test('formaterContenance relit ce que lireContenance écrit', () => {
  for (const t of ['150 g', '1,5 L', '75 cl', '1,2 kg', '33 cl']) assert.equal(formaterContenance(lireContenance(t)), t);
  assert.equal(formaterContenance({ grammage_g: null, volume_ml: 125 }), '125 ml');
  assert.equal(formaterContenance({ grammage_g: null, volume_ml: null }), null);
});

test('champsModifies : seulement ce qui a vraiment changé', () => {
  assert.deepEqual(champsModifies(produit, { ...produit }), []);
  assert.deepEqual(champsModifies(produit, { ...produit, name: 'Allumettes', grammage_g: 150, brand: 'Carrefour' }), ['name', 'brand', 'contenance']);
  assert.deepEqual(champsModifies(produit, { ...produit, brand: '' }), []);
});

test('fusionnerManuels ne duplique pas', () => {
  assert.deepEqual(fusionnerManuels(['name'], ['brand', 'name']), ['brand', 'name']);
  assert.deepEqual(fusionnerManuels(null, ['category']), ['category']);
});

test('differencesOff : avant et après, rien quand Open Food Facts ne sait pas', () => {
  const d = differencesOff(produit, off);
  assert.deepEqual(d.map((x) => [x.champ, x.avant, x.apres, x.protege]), [
    ['name', produit.name, 'Allumettes nature sans nitrite', false],
    ['brand', null, 'Carrefour', false],
    ['contenance', '200 g', '150 g', false],
    ['image_url', produit.image_url, off.imageUrl, false],
  ]);
  assert.deepEqual(differencesOff(produit, { ...off, brand: null, nutriscore: null, imageUrl: null, categoryKey: 'autre', name: produit.name, grammageG: 200 }), []);
});

test('differencesOff protège les corrections manuelles et la photo améliorée', () => {
  const d = differencesOff({ ...produit, champs_manuels: ['name'], image_originale: 'https://images.openfoodfacts.org/a.jpg' }, off);
  const nom = d.find((x) => x.champ === 'name'), photo = d.find((x) => x.champ === 'image_url');
  assert.equal(nom.protege, true); assert.equal(nom.raison, 'Corrigé à la main');
  assert.equal(photo.protege, true); assert.equal(photo.raison, 'Ta photo améliorée est gardée');
  assert.equal(d.find((x) => x.champ === 'brand').protege, false);
});

test('patchDepuisOff n’écrit que les champs retenus', () => {
  assert.deepEqual(patchDepuisOff(off, ['name', 'contenance']), { name: 'Allumettes nature sans nitrite', grammage_g: 150, volume_ml: null });
  assert.deepEqual(patchDepuisOff(off, []), {});
});

test('pertesSuppression : les vrais nombres, et rien quand rien ne part', () => {
  assert.deepEqual(pertesSuppression({ correspondances: 2, achats: 7, recettes: 2, alternativeDe: 'Papier toilette Lotus' }), {
    pertes: ['ses correspondances Carrefour et Leclerc', 'son historique : 7 achats', 'sa place parmi les alternatives de « Papier toilette Lotus »'],
    garde: 'Les 2 recettes qui l’utilisent gardent l’ingrédient, sans produit associé.',
  });
  assert.deepEqual(pertesSuppression({ correspondances: 1, achats: 1, recettes: 1, alternativeDe: null }), {
    pertes: ['sa correspondance drive', 'son historique : 1 achat'],
    garde: 'La recette qui l’utilise garde l’ingrédient, sans produit associé.',
  });
  assert.deepEqual(pertesSuppression({ correspondances: 0, achats: 0, recettes: 0, alternativeDe: null }), { pertes: [], garde: null });
});

test('contenance en pièces : lue, formatée, relue', () => {
  assert.deepEqual(lireContenance('6 pièces'), { grammage_g: null, volume_ml: null, nombre_unites: 6 });
  assert.deepEqual(lireContenance('x12'), { grammage_g: null, volume_ml: null, nombre_unites: 12 });
  assert.deepEqual(lireContenance('6 œufs'), { grammage_g: null, volume_ml: null, nombre_unites: 6 });
  assert.deepEqual(lireContenance('4 x 125 g'), { grammage_g: 500, volume_ml: null, nombre_unites: 4 });
  assert.deepEqual(lireContenance('1,5 L'), { grammage_g: null, volume_ml: 1500 });
  const v = { grammage_g: 500, volume_ml: null, nombre_unites: 4 };
  assert.equal(formaterContenance(v), '500 g · 4 pièces');
  assert.deepEqual(lireContenance(formaterContenance(v)), v);
  assert.equal(formaterContenance({ grammage_g: null, volume_ml: null, nombre_unites: 6 }), '6 pièces');
  assert.equal(lireContenance('150 g · 1 L'), null);
});
