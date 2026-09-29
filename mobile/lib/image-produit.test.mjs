import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleImage, teinteAplat } from './image-produit.ts';

test('cleImage : accents, casse, espaces et ponctuation ne comptent pas', () => {
 assert.equal(cleImage('  Pommes de terre  BIO '), 'pommes de terre bio');
 assert.equal(cleImage('Œufs plein-air'), 'oeufs plein air');
 assert.equal(cleImage('Crème fraîche'), cleImage('creme FRAICHE'));
 assert.equal(cleImage('x'.repeat(200)).length, 80);
});

test('teinteAplat : stable pour un même produit, écrit autrement', () => {
 assert.equal(teinteAplat('Lessive'), teinteAplat(' lessive '));
 assert.match(teinteAplat('café'), /^#[0-9A-F]{6}$/);
});
