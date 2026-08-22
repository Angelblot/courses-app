/**
 * Décodage base64 vers octets. Nécessaire pour déposer une photo : Hermes
 * n'expose pas `atob`, et `fetch` sur une adresse file:// se comporte
 * différemment selon les versions de React Native.
 * Lancer : node --test mobile/lib/base64.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base64VersOctets } from './base64.ts';

const encoder = (texte) => Buffer.from(texte, 'utf8').toString('base64');

test('un texte simple fait l\'aller-retour', () => {
  const octets = base64VersOctets(encoder('Bonjour'));
  assert.equal(Buffer.from(octets).toString('utf8'), 'Bonjour');
});

test('les trois longueurs de remplissage sont gérées', () => {
  // 0, 1 et 2 signes « = » : c'est là que les décodeurs maison se trompent.
  for (const t of ['abc', 'ab', 'a', 'abcd', 'abcde']) {
    const octets = base64VersOctets(encoder(t));
    assert.equal(Buffer.from(octets).toString('utf8'), t, `échec pour ${t}`);
  }
});

test('les octets non textuels sont préservés', () => {
  const brut = Buffer.from([0x00, 0xff, 0x10, 0x89, 0x7f]);
  const octets = base64VersOctets(brut.toString('base64'));
  assert.deepEqual(Buffer.from(octets), brut);
});

test('une chaîne vide donne zéro octet', () => {
  assert.equal(base64VersOctets('').length, 0);
});

test('les retours à la ligne sont tolérés', () => {
  // Certaines sources renvoient du base64 découpé en lignes.
  const avecSauts = encoder('Bonjour tout le monde').replace(/(.{4})/g, '$1\n');
  assert.equal(Buffer.from(base64VersOctets(avecSauts)).toString('utf8'), 'Bonjour tout le monde');
});
