/**
 * Décision d'afficher le bandeau de suivi. Fonction pure, sans réseau.
 * Lancer : node --test mobile/lib/suivi-bandeau.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doitAfficher, estActif, estClos } from './suivi-bandeau.ts';

test('les quatre états actifs affichent le bandeau', () => {
  for (const status of ['pending', 'claimed', 'running', 'needs_action']) {
    assert.equal(doitAfficher({ id: 'a', status }, null), true, `manque pour ${status}`);
    assert.equal(estActif(status), true);
  }
});

test("un travail actif reste affiché même si son identifiant a été acquitté", () => {
  // L'acquittement ne vaut que pour un travail clos. Un remplissage relancé
  // sur le même identifiant doit se revoir.
  assert.equal(doitAfficher({ id: 'a', status: 'running' }, 'a'), true);
});

test('un travail terminé mais non acquitté affiche encore', () => {
  // C'est au bilan qu'il y a quelque chose à apprendre : ce qui n'a pas été
  // ajouté. Le faire disparaître tout seul le ferait manquer.
  assert.equal(doitAfficher({ id: 'a', status: 'done' }, null), true);
  assert.equal(doitAfficher({ id: 'a', status: 'failed' }, 'autre'), true);
});

test('un travail terminé et acquitté disparaît', () => {
  assert.equal(doitAfficher({ id: 'a', status: 'done' }, 'a'), false);
  assert.equal(doitAfficher({ id: 'a', status: 'failed' }, 'a'), false);
});

test('un travail annulé ne se montre jamais', () => {
  // « cancelled » n'est ni actif ni clos au sens du bilan : il n'y a rien à
  // regarder.
  assert.equal(doitAfficher({ id: 'a', status: 'cancelled' }, null), false);
  assert.equal(estActif('cancelled'), false);
  assert.equal(estClos('cancelled'), false);
});

test("l'absence de travail n'affiche rien", () => {
  assert.equal(doitAfficher(null, null), false);
  assert.equal(doitAfficher(null, 'a'), false);
});

test("un état inconnu ne fait pas apparaître le bandeau", () => {
  assert.equal(doitAfficher({ id: 'a', status: 'quelque_chose' }, null), false);
});
