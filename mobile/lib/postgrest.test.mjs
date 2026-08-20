/**
 * Fige le contrat entre postgrest-js et `estErreurReseau`, dans les deux
 * sens : c'est le pivot de toute la file d'attente hors connexion (voir
 * `lib/postgrest.ts`). Une régression silencieuse ici ferait perdre des
 * scans en attente sans que rien ne le signale.
 * Lancer : node --test mobile/lib/postgrest.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estErreurReseau } from './postgrest.ts';

test('un code absent est traité comme une panne réseau', () => {
  assert.equal(estErreurReseau({}), true);
});

test('un code vide (comportement actuel de postgrest-js) est traité comme une panne réseau', () => {
  assert.equal(estErreurReseau({ code: '' }), true);
});

test('une violation de contrainte unique n\'est pas une panne réseau', () => {
  assert.equal(estErreurReseau({ code: '23505' }), false);
});

test('une violation RLS n\'est pas une panne réseau', () => {
  assert.equal(estErreurReseau({ code: '42501' }), false);
});

test('un code d\'erreur PostgREST n\'est pas une panne réseau', () => {
  assert.equal(estErreurReseau({ code: 'PGRST116' }), false);
});
