import { test } from 'node:test';
import assert from 'node:assert/strict';
import { references, classement, reordonner, referencePourNom, enseigneExclusive, enseigneDeduite, referenceDe, produitsProbables, retenirPhrase, phraseSiri } from './references.ts';

const emmental = { id: 'e', name: 'Emmental râpé fondant CARREFOUR', brand: "CLASSIC'", product_type: 'fromage_rape', alternatives: ['g', 'p', 'disparu'] };
const gruyere = { id: 'g', name: 'Gruyère Râpé', brand: 'Leclerc', product_type: 'fromage_rape', alternatives: [] };
const parmesan = { id: 'p', name: 'Parmigiano Reggiano râpé', brand: 'Monoprix', product_type: 'fromage_rape', alternatives: [] };
const oeufs = { id: 'o', name: 'Œufs Plein Air', brand: null, product_type: 'oeuf', alternatives: [] };
const tous = [emmental, gruyere, parmesan, oeufs];

test('références : une alternative ne figure plus seule', () => {
 assert.deepEqual(references(tous).map(p => p.id), ['e', 'o']);
});

test('classement : la référence puis ses alternatives existantes, sans doublon', () => {
 assert.deepEqual(classement(emmental, tous).map(p => p.id), ['e', 'g', 'p']);
 assert.equal(referenceDe('g', tous).id, 'e');
 assert.equal(referenceDe('o', tous).id, 'o');
});

test('reordonner : le premier devient la référence, l\'ancienne se vide', () => {
 assert.deepEqual(reordonner('e', ['e', 'p', 'g']), [{ id: 'e', alternatives: ['p', 'g'] }]);
 assert.deepEqual(reordonner('e', ['g', 'e', 'p']), [{ id: 'g', alternatives: ['e', 'p'] }, { id: 'e', alternatives: [] }]);
});

test('Siri : le besoin retrouve la référence de son type, jamais une alternative', () => {
 const ref = referencePourNom('œufs', tous);
 assert.equal(ref?.id, 'o');
 assert.equal(referencePourNom('xyzzy', tous), undefined);
});

test('marques distributeur : réservées à leur enseigne', () => {
 assert.equal(enseigneExclusive(emmental), 'carrefour');
 assert.equal(enseigneExclusive(gruyere), 'leclerc');
 assert.equal(enseigneExclusive({ name: 'Lessive Marque Repère', brand: null }), 'leclerc');
 assert.equal(enseigneExclusive(parmesan), null);
 assert.equal(enseigneExclusive(oeufs), null);
});

test('Siri : une phrase retenue l\'emporte sur le type, et désigne la référence', () => {
 const lotus = { id: 'l', name: 'Papier toilette Lotus Confort', brand: 'Lotus', product_type: 'papier toilette', alternatives: ['k'], phrases_siri: [] };
 const okay = { id: 'k', name: 'Papier toilette Okay', brand: 'Okay', product_type: 'papier toilette', phrases_siri: ['PQ'] };
 assert.equal(referencePourNom('pq', [lotus, okay])?.id, 'l');
 assert.equal(referencePourNom('  P.Q ', [lotus, { ...okay, phrases_siri: ['p q'] }])?.id, 'l');
 assert.equal(phraseSiri('Œufs  frais !'), 'oeufs frais');
});

test('produits probables : même type d\'abord, puis mots en commun, références seulement', () => {
 const lotus = { id: 'l', name: 'Papier toilette Lotus', brand: 'Lotus', product_type: 'papier toilette' };
 const essuie = { id: 's', name: 'Essuie-tout Okay', brand: 'Okay', product_type: 'essuie tout' };
 const papierCuisson = { id: 'c', name: 'Papier cuisson', brand: null, product_type: 'papier cuisson' };
 assert.deepEqual(produitsProbables('papier toilette', [essuie, papierCuisson, lotus]).map(p => p.id), ['l', 'c']);
 assert.deepEqual(produitsProbables('PQ', [essuie, lotus]).map(p => p.id), ['l']);
 assert.deepEqual(produitsProbables('les trucs des enfants', [essuie, lotus]), []);
 assert.deepEqual(produitsProbables('lotus', [{ ...essuie, alternatives: ['l'] }, lotus]).map(p => p.id), []);
});

test('retenir une phrase : ajoutée au produit, retirée des autres, sans doublon', () => {
 const a = { id: 'a', name: 'A', brand: null, product_type: null, phrases_siri: ['pq'] };
 const b = { id: 'b', name: 'B', brand: null, product_type: null, phrases_siri: ['papier wc'] };
 assert.deepEqual(retenirPhrase('b', 'PQ', [a, b]), [{ id: 'a', phrases_siri: [] }, { id: 'b', phrases_siri: ['papier wc', 'pq'] }]);
 assert.deepEqual(retenirPhrase('a', 'P.Q.', [a, b]), []);
 assert.deepEqual(retenirPhrase('a', '  ', [a, b]), []);
});

test('vendu chez : le choix manuel l\'emporte sur la marque', () => {
 const reflets = { name: 'Papier toilette Reflets de France', brand: null };
 assert.equal(enseigneDeduite(reflets), 'carrefour');
 assert.equal(enseigneExclusive({ ...reflets, vendu_chez: 'partout' }), null);
 assert.equal(enseigneExclusive({ ...reflets, vendu_chez: 'leclerc' }), 'leclerc');
 assert.equal(enseigneExclusive({ ...reflets, vendu_chez: null }), 'carrefour');
});

test('Siri : un type retiré ne désigne plus le produit, ses phrases si', () => {
 const mayo = { id: 'm', name: 'Mayonnaise', brand: null, product_type: 'condiment', alternatives: [], phrases_siri: ['mayonnaise'] };
 assert.equal(referencePourNom('condiment', [mayo])?.id, 'm');
 const sans = { ...mayo, siri_sans_type: true };
 assert.equal(referencePourNom('condiment', [sans]), undefined);
 assert.equal(referencePourNom('ketchup', [sans]), undefined);
 assert.equal(referencePourNom('mayonnaise', [sans])?.id, 'm');
});
