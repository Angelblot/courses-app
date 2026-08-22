/**
 * Consolidation de la liste de courses.
 * Lancer : node --test mobile/lib/consolidation.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConsolidatedItems, groupByRayon, getRecipeUsage, getRecipeIngredientMatches,
  construireItems,
} from './consolidation.ts';

const RECETTES = [
  {
    id: 'r1', name: 'Carbonara',
    ingredients: [
      { name: 'Lardons fumés', quantity_per_serving: 50, unit: 'g', rayon: 'charcuterie' },
      { name: 'Spaghetti', quantity_per_serving: 100, unit: 'g', rayon: 'epicerie' },
    ],
  },
  {
    id: 'r2', name: 'Gratin',
    ingredients: [
      { name: 'Spaghetti', quantity_per_serving: 50, unit: 'g', rayon: 'epicerie' },
    ],
  },
];

test('deux recettes qui demandent le même ingrédient le fusionnent', () => {
  const items = buildConsolidatedItems({
    recipes: RECETTES,
    selectedRecipes: { r1: 4, r2: 2 },
    quotidien: {}, quotidienQty: {}, extras: [], products: [],
  });
  const spaghetti = items.find((i) => i.name === 'Spaghetti');
  // 100 × 4 parts + 50 × 2 parts
  assert.equal(spaghetti.totalQuantity, 500);
  assert.equal(spaghetti.sources.length, 2);
});

test("une recette non retenue n'entre pas dans la liste", () => {
  const items = buildConsolidatedItems({
    recipes: RECETTES,
    selectedRecipes: { r1: 4 },
    quotidien: {}, quotidienQty: {}, extras: [], products: [],
  });
  assert.equal(items.find((i) => i.name === 'Lardons fumés').totalQuantity, 200);
  assert.equal(items.length, 2);
});

test('le rayon est toujours une clé canonique, jamais un libellé', () => {
  const items = buildConsolidatedItems({
    recipes: [{ id: 'r3', name: 'X', ingredients: [
      { name: 'Poulet', quantity_per_serving: 1, unit: 'kg', rayon: 'Boucherie' },
    ] }],
    selectedRecipes: { r3: 4 },
    quotidien: {}, quotidienQty: {}, extras: [], products: [],
  });
  assert.equal(items[0].rayon, 'pls');
});

test('les ajouts manuels rejoignent la liste', () => {
  const items = buildConsolidatedItems({
    recipes: [], selectedRecipes: {}, quotidien: {}, quotidienQty: {},
    extras: [{ id: 'e1', name: 'Piles AA', quantity: 1, unit: 'unité', rayon: 'maison' }],
    products: [],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].rayon, 'maison');
});

test("un produit du quotidien marqué « à acheter » entre avec sa quantité", () => {
  const items = buildConsolidatedItems({
    recipes: [], selectedRecipes: {},
    quotidien: { p1: 'needed' }, quotidienQty: { p1: 3 }, extras: [],
    products: [{ id: 'p1', name: 'Lait', unit: 'unité', category: 'pls', ean13: '123' }],
  });
  assert.equal(items[0].totalQuantity, 3);
  assert.equal(items[0].rayon, 'pls');
  assert.equal(items[0].ean13, '123');
});

test("un produit marqué « j'en ai déjà » n'entre pas", () => {
  const items = buildConsolidatedItems({
    recipes: [], selectedRecipes: {},
    quotidien: { p1: 'have' }, quotidienQty: {}, extras: [],
    products: [{ id: 'p1', name: 'Lait', unit: 'unité', category: 'pls' }],
  });
  assert.equal(items.length, 0);
});

test("groupByRayon suit l'ordre du magasin, pas l'alphabet", () => {
  const groupes = groupByRayon([
    { key: 'a', name: 'Sucre', unit: 'g', rayon: 'epicerie', totalQuantity: 1, ean13: null, sources: [] },
    { key: 'b', name: 'Lait', unit: 'unité', rayon: 'pls', totalQuantity: 1, ean13: null, sources: [] },
  ]);
  // pls (ordre 1) précède epicerie (ordre 4) : l'alphabet ferait l'inverse.
  assert.deepEqual(groupes.map((g) => g.rayon), ['pls', 'epicerie']);
});

test("getRecipeUsage totalise ce qu'un produit doit couvrir", () => {
  const u = getRecipeUsage({
    productId: null,
    productName: 'Spaghetti',
    productUnit: 'unité',
    product: { name: 'Spaghetti n°5', unit: 'unité', grammage_g: 500 },
    selectedRecipes: { r1: 4, r2: 2 },
    recipes: RECETTES,
  });
  // 500 g au total, en paquets de 500 g : un paquet.
  assert.equal(u.totalQuantity, 1);
  assert.equal(u.breakdown.length, 2);
});

test('getRecipeIngredientMatches regroupe par type et propose les candidats', () => {
  const groupes = getRecipeIngredientMatches({
    selectedRecipes: { r1: 4 },
    recipes: RECETTES,
    products: [
      { id: 'p1', name: 'Lardons fumés CARREFOUR', product_type: 'lardon' },
      { id: 'p2', name: 'Allumettes de bacon', product_type: 'lardon' },
      { id: 'p3', name: 'Sucre en poudre', product_type: 'sucre' },
    ],
  });
  const lardons = groupes.find((g) => g.productType === 'lardon');
  assert.equal(lardons.matchingProducts.length, 2);
  assert.equal(lardons.totalQty, 200);
});

test('cinq recettes partageant un ingrédient ne font pas acheter cinq paquets', () => {
  // Régression corrigée au portage : la version web convertissait chaque
  // recette puis additionnait, si bien que 5 × 100 g d'un produit vendu par
  // 500 g donnaient 5 paquets au lieu d'un seul. On additionne d'abord.
  const recettes = Array.from({ length: 5 }, (_, i) => ({
    id: `r${i}`, name: `Recette ${i}`,
    ingredients: [{ name: 'Farine', quantity_per_serving: 25, unit: 'g', rayon: 'epicerie' }],
  }));
  const u = getRecipeUsage({
    productId: null,
    productName: 'Farine',
    productUnit: 'unité',
    product: { id: 'p', name: 'Farine T55', unit: 'unité', grammage_g: 500 },
    selectedRecipes: Object.fromEntries(recettes.map((r) => [r.id, 4])),
    recipes: recettes,
  });
  // 5 × 25 g × 4 parts = 500 g : un paquet.
  assert.equal(u.totalQuantity, 1);
  assert.equal(u.breakdown.length, 5);
});

test('chaque ligne consolidée devient un article de panier', () => {
  const items = construireItems([
    { key: 'a', name: 'Lardons', unit: 'g', rayon: 'charcuterie',
      totalQuantity: 200, ean13: '3760040427577', sources: [] },
  ]);
  assert.deepEqual(items, [{
    name: 'Lardons', quantity: 200, unit: 'g',
    ean13: '3760040427577', category: 'charcuterie',
  }]);
});

test('un article sans code-barres part quand même, avec ean13 à null', () => {
  // C'est le cas des ajouts manuels : l'extension retombera sur la recherche
  // par nom, avec son score et sa détection d'ambiguïté.
  const items = construireItems([
    { key: 'b', name: 'Piles AA', unit: 'unité', rayon: 'maison',
      totalQuantity: 1, ean13: null, sources: [] },
  ]);
  assert.equal(items[0].ean13, null);
});

test('une liste vide ne produit aucun article', () => {
  assert.deepEqual(construireItems([]), []);
});
