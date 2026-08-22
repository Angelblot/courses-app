/**
 * Libellés et garde-fous du foyer. Fonctions pures, sans réseau.
 * Lancer : node --test mobile/lib/foyer-libelles.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { libelleMembre, peutRetirer } from './foyer-libelles.ts';

test('le créateur est signalé comme tel', () => {
  assert.match(libelleMembre({ role: 'createur', joined_at: '2026-08-22' }), /cr[ée]/i);
});

test("un membre qui n'a pas ouvert son lien est en attente", () => {
  assert.match(libelleMembre({ role: 'membre', joined_at: null }), /attente/i);
});

test('un membre actif est simplement membre', () => {
  assert.equal(libelleMembre({ role: 'membre', joined_at: '2026-08-22' }), 'Membre');
});

test('aucun libellé ne laisse fuir un code technique', () => {
  for (const m of [
    { role: 'createur', joined_at: null },
    { role: 'membre', joined_at: null },
    { role: 'membre', joined_at: '2026-08-22' },
  ]) {
    const t = libelleMembre(m);
    assert.ok(!t.includes(m.role), `le rôle fuit : ${t}`);
  }
});

test('le créateur peut retirer un membre ordinaire', () => {
  assert.equal(
    peutRetirer({ role: 'createur', user_id: 'a' }, { role: 'membre', user_id: 'b' }),
    true,
  );
});

test('personne ne peut se retirer soi-même', () => {
  // Un foyer sans membre serait un foyer dont les données deviennent
  // inaccessibles à tous.
  assert.equal(
    peutRetirer({ role: 'createur', user_id: 'a' }, { role: 'createur', user_id: 'a' }),
    false,
  );
});

test('un membre ordinaire ne retire personne', () => {
  assert.equal(
    peutRetirer({ role: 'membre', user_id: 'b' }, { role: 'membre', user_id: 'c' }),
    false,
  );
});

test('le créateur ne peut pas être retiré', () => {
  assert.equal(
    peutRetirer({ role: 'createur', user_id: 'a' }, { role: 'createur', user_id: 'z' }),
    false,
  );
});
