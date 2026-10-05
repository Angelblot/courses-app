import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visiter, precedentDe, rangDans } from './parcours-preciser.ts';
import { rouvrirManque } from './session-courses.ts';

test('le parcours garde l’ordre de visite, un point revenu passe en dernier', () => {
 let p = visiter([], 'a'); p = visiter(p, 'b'); p = visiter(p, 'c');
 assert.deepEqual(p, ['a', 'b', 'c']);
 assert.deepEqual(visiter(p, 'c'), p);
 assert.deepEqual(visiter(p, 'a'), ['b', 'c', 'a']);
});

test('précédent remonte le parcours, rien au premier', () => {
 const p = ['a', 'b', 'c'];
 assert.equal(precedentDe(p, 'c'), 'b');
 assert.equal(precedentDe(p, 'a'), null);
 assert.equal(precedentDe(p, 'z'), 'c');
 assert.equal(precedentDe([], 'z'), null);
});

test('le rang suit le parcours, un point neuf vient après', () => {
 assert.equal(rangDans(['a', 'b'], 'b'), 2);
 assert.equal(rangDans(['a', 'b'], 'c'), 3);
});

const base = { manques: {}, quotidien: {}, quotidienQty: {}, extras: [], ligneQuantites: {}, lignePossedees: {} };

test('rouvrir un extra réglé par un produit le remet tel qu’avant, sans toucher aux autres', () => {
 const avant = { ...base, manques: { 'extra:x': { name: 'Febrèze', source: 'manuel' } }, extras: [{ id: 'x', name: 'Febrèze', quantity: 1 }] };
 // Après validation avec le produit p1, et un autre point réglé depuis (p2).
 const apres = { ...base, manques: { 'produit:p1': { name: 'Febrèze', source: 'manuel', valide: true }, 'extra:y': { name: 'WC', source: 'manuel', valide: true } },
  quotidien: { p1: 'needed', p2: 'needed' }, quotidienQty: { p1: 1, p2: 3 }, lignePossedees: { 'produit:p1': false }, extras: [] };
 const r = rouvrirManque(apres, avant, 'extra:x', 'p1');
 assert.deepEqual(r.manques['extra:x'], { name: 'Febrèze', source: 'manuel' });
 assert.equal(r.manques['produit:p1'], undefined);
 assert.equal(r.manques['extra:y'].valide, true);
 assert.deepEqual(r.quotidien, { p2: 'needed' });
 assert.deepEqual(r.quotidienQty, { p2: 3 });
 assert.deepEqual(r.extras, [{ id: 'x', name: 'Febrèze', quantity: 1 }]);
 assert.equal('produit:p1' in r.lignePossedees, false);
});

test('rouvrir un point gardé sans produit retire seulement sa validation', () => {
 const avant = { ...base, manques: { 'extra:x': { name: 'Javel', source: 'manuel' } }, extras: [{ id: 'x', name: 'Javel', quantity: 2 }] };
 const apres = { ...base, manques: { 'extra:x': { name: 'Javel', source: 'manuel', valide: true } }, extras: [{ id: 'x', name: 'Javel', quantity: 2 }] };
 const r = rouvrirManque(apres, avant, 'extra:x');
 assert.equal(r.manques['extra:x'].valide, undefined);
 assert.deepEqual(r.extras, avant.extras);
});
