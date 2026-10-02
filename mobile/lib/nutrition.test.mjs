import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireDetails, meilleurs } from './nutrition.ts';

const pepito = { nutriments: { 'energy-kcal_100g': 440, fat_100g: 23, 'saturated-fat_100g': 11, sugars_100g: 30, salt_100g: 0.84, fiber_100g: 2.7, proteins_100g: 5.2 },
 nutrient_levels: { fat: 'high', 'saturated-fat': 'high', sugars: 'high', salt: 'moderate' }, nova_group: 4, ecoscore_grade: 'e',
 allergens_tags: ['en:eggs', 'en:gluten', 'en:milk', 'en:soybeans'], ingredients_text_fr: 'Farine de _BLÉ_ 23 %, sucre', serving_size: '30g' };

test('détails lus depuis Open Food Facts', () => {
 const d = lireDetails(pepito);
 assert.deepEqual([d.kcal, d.sucres, d.sel, d.nova, d.ecoscore, d.portion], [440, 30, 0.84, 4, 'e', '30g']);
 assert.deepEqual(d.niveaux, { gras: 'high', satures: 'high', sucres: 'high', sel: 'moderate' });
 assert.deepEqual(d.allergenes, ['œufs', 'gluten', 'lait', 'soja']);
 assert.equal(d.ingredients, 'Farine de BLÉ 23 %, sucre');
 assert.equal(lireDetails({}), null);
 assert.equal(lireDetails({ nutriments: { 'energy-kcal_100g': 'x' }, ecoscore_grade: 'not-applicable' }), null);
});

test('meilleurs par ligne : plus bas gagne, égalité sans gagnant', () => {
 const a = { nutriscore: 'e', details: lireDetails(pepito) };
 const b = { nutriscore: 'e', details: lireDetails({ ...pepito, nutriments: { ...pepito.nutriments, sugars_100g: 29, salt_100g: 0.66 }, ecoscore_grade: 'c', allergens_tags: ['en:gluten'] }) };
 const c = { nutriscore: 'd', details: null };
 const m = meilleurs([a, b, c]);
 assert.deepEqual(m.nutriscore, [2]);
 assert.deepEqual(m.sucres, [1]);
 assert.deepEqual(m.ecoscore, [1]);
 assert.deepEqual(m.allergenes, [1]);
 assert.deepEqual(m.nova, []);
 assert.deepEqual(m.kcal, []);
});
