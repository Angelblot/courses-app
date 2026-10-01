import { test } from 'node:test';
import assert from 'node:assert/strict';
import { references, classement, reordonner, referencePourNom, enseigneExclusive, referenceDe } from './references.ts';

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
