/**
 * Validation d'un brouillon de recette et proposition de rayon.
 * Lancer : node --test mobile/lib/recette-brouillon.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valideBrouillon, rayonPropose, produitPropose } from './recette-brouillon.ts';

const OK = {
  name: 'Carbonara',
  servings_default: 4,
  ingredients: [
    { name: 'Lardons', quantity_per_serving: 50, unit: 'g', rayon: 'charcuterie', product_id: null },
  ],
};

test('un brouillon complet est accepté', () => {
  assert.equal(valideBrouillon(OK), null);
});

test('une recette sans nom est refusée', () => {
  assert.match(valideBrouillon({ ...OK, name: '   ' }), /nom/i);
});

test('une recette sans ingrédient est refusée', () => {
  // Une recette vide passerait la validation puis produirait une liste vide,
  // sans que rien n'explique pourquoi.
  assert.match(valideBrouillon({ ...OK, ingredients: [] }), /ingr/i);
});

test('un nombre de parts nul ou négatif est refusé', () => {
  assert.match(valideBrouillon({ ...OK, servings_default: 0 }), /parts?/i);
});

test('un ingrédient sans nom est refusé, en indiquant sa position', () => {
  const msg = valideBrouillon({
    ...OK,
    ingredients: [{ name: '', quantity_per_serving: 1, unit: 'g', rayon: 'epicerie', product_id: null }],
  });
  assert.match(msg, /1/);
});

test('les messages sont en français, jamais un code technique', () => {
  const msg = valideBrouillon({ ...OK, name: '' });
  assert.ok(!/error|invalid|required/i.test(msg), `message technique : ${msg}`);
});

test('le rayon proposé vient du produit du catalogue de même type', () => {
  const produits = [{ product_type: 'lardon', category: 'charcuterie' }];
  assert.equal(rayonPropose('Lardons fumés', produits), 'charcuterie');
});

test('sans produit correspondant, le rayon proposé est « autre »', () => {
  assert.equal(rayonPropose('Poudre de perlimpinpin', []), 'autre');
  assert.equal(rayonPropose('', []), 'autre');
});

// --- Rattachement au catalogue ---
//
// Éprouvé le 24/08 sur 74 ingrédients réels importés de Jow. La typologie
// seule regroupait bien trop large : « fromage » couvre le gorgonzola comme
// la feta, et la feta se rattachait au gorgonzola. Un rattachement faux est
// pire qu'absent — l'extension achèterait le mauvais produit sans rien dire,
// là où un ingrédient libre se voit et se cherche par son nom.

const CATALOGUE = [
  { id: 'feta', name: 'Féta cubes AOP CARREFOUR', product_type: 'féta', category: 'pls' },
  { id: 'gorgo', name: 'Gorgonzola AOP CARREFOUR', product_type: 'fromage', category: 'pls' },
  { id: 'savon', name: 'Savon Liquide Mains Lait Et Miel', product_type: 'lait', category: 'parfumerie' },
  { id: 'lait', name: 'Lait Demi-Ecrémé UHT Bio', product_type: 'lait', category: 'pls' },
  { id: 'oignon', name: 'Oignons jaunes vrac', product_type: 'oignon', category: 'fruits_legumes' },
  { id: 'spag', name: 'Pâtes spaghetti n°5', product_type: 'pate', category: 'epicerie' },
  { id: 'gnoc', name: 'Pâtes Fraîches Gnocchi À Poêler', product_type: 'pate', category: 'pls' },
  { id: 'boursin', name: 'Boursin Onctueux Ail & Fines Herbes', product_type: 'ail', category: 'pls' },
];

test('un nom qui se retrouve tel quel dans le produit le rattache', () => {
  assert.equal(produitPropose('Gorgonzola', CATALOGUE).id, 'gorgo');
  assert.equal(produitPropose('Oignon jaune', CATALOGUE).id, 'oignon');
});

test("l'accent et le pluriel ne font pas manquer un produit", () => {
  // « Feta » sans accent doit retrouver « Féta », et « Oignon jaune » au
  // singulier doit retrouver « Oignons jaunes vrac ».
  assert.equal(produitPropose('Feta', CATALOGUE).id, 'feta');
  assert.equal(produitPropose('Oignons jaunes', CATALOGUE).id, 'oignon');
});

test('la parenthèse est retentée à part quand le nom entier échoue', () => {
  // « Pâtes (spaghetti) » trouve les spaghettis par son nom entier, pas par
  // le mot « pâtes » — qui désigne aussi les gnocchis.
  assert.equal(produitPropose('Pâtes (spaghetti)', CATALOGUE).id, 'spag');
  assert.equal(produitPropose('Gnocchi (à poêler)', CATALOGUE).id, 'gnoc');
});

test("un ingrédient ne se rattache jamais à un non-alimentaire", () => {
  // « Miel » se rattachait au « Savon Liquide Mains Lait Et Miel ».
  assert.equal(produitPropose('Miel', CATALOGUE), null);
  assert.equal(produitPropose('Lait', CATALOGUE).id, 'lait');
});

test('rien plutôt que le mauvais quand plusieurs produits conviennent', () => {
  // « Pâtes » désigne aussi bien les spaghettis que les gnocchis : choisir au
  // hasard mettrait le mauvais produit dans le panier sans le signaler.
  assert.equal(produitPropose('Pâtes', CATALOGUE), null);
});

test('un nom trop court ne discrimine rien', () => {
  // « Ail » se retrouve dans « Boursin Ail & Fines Herbes », qui n'est pas
  // de l'ail.
  assert.equal(produitPropose('Ail', CATALOGUE), null);
  assert.equal(produitPropose('', CATALOGUE), null);
});

test("un ingrédient absent du catalogue reste libre", () => {
  assert.equal(produitPropose('Poudre de perlimpinpin', CATALOGUE), null);
  assert.equal(produitPropose('Reblochon', CATALOGUE), null);
});

test('le rayon reste proposé par la typologie, plus large que le produit', () => {
  // Un rayon faux range mal un article ; un produit faux le met dans le
  // panier. Le premier peut se permettre d'être approximatif.
  // « Fromage » ne se retrouve dans le nom d'aucun produit, donc aucun
  // rattachement — mais sa typologie suffit à le ranger en crémerie.
  assert.equal(produitPropose('Fromage', CATALOGUE), null);
  assert.equal(rayonPropose('Fromage', CATALOGUE), 'pls');
  assert.equal(rayonPropose('Poudre de perlimpinpin', CATALOGUE), 'autre');
});
