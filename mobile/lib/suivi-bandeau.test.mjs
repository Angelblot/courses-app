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

// --- Oubli des travaux que l'extension n'a jamais pris en charge ---

const HEURE = 3600_000;
const MAINTENANT = Date.parse('2026-08-24T12:00:00Z');
const ilYA = (h) => new Date(MAINTENANT - h * HEURE).toISOString();

test("un travail en attente depuis deux jours n'est plus annoncé", () => {
  // Constaté le 24/08 : un travail « pending » vieux de deux jours affichait
  // « Ta liste attend sur ton Mac » indéfiniment, alors que l'extension ne
  // l'avait jamais ouvert. Le bandeau disait vrai et n'informait plus.
  const vieux = { id: 'a', status: 'pending', created_at: ilYA(51) };
  assert.equal(doitAfficher(vieux, null, MAINTENANT), false);
});

test("un travail en attente depuis peu reste annoncé", () => {
  // Composer sa liste le soir et ouvrir le Mac le lendemain matin doit
  // continuer de marcher : c'est le parcours normal.
  assert.equal(
    doitAfficher({ id: 'a', status: 'pending', created_at: ilYA(11) }, null, MAINTENANT),
    true,
  );
});

test("l'oubli ne touche que ce qui n'a jamais démarré", () => {
  // Un remplissage en cours depuis longtemps est peut-être lent, pas mort —
  // et « needs_action » attend justement qu'on intervienne, sans limite.
  for (const status of ['running', 'needs_action']) {
    assert.equal(
      doitAfficher({ id: 'a', status, created_at: ilYA(72) }, null, MAINTENANT),
      true,
      `« ${status} » ne doit pas s'oublier`,
    );
  }
});

test("un travail sans date de création reste annoncé", () => {
  // Ne jamais faire disparaître un bandeau sur une donnée manquante : mieux
  // vaut un bandeau de trop qu'une liste oubliée en silence.
  assert.equal(doitAfficher({ id: 'a', status: 'pending' }, null, MAINTENANT), true);
  assert.equal(
    doitAfficher({ id: 'a', status: 'pending', created_at: 'n/importe quoi' }, null, MAINTENANT),
    true,
  );
});

test("on peut écarter un travail actif, état par état", () => {
  // Écarter vaut pour l'état écarté, pas pour le travail : s'il passe à
  // « running », il se remontre, car il se passe alors quelque chose de neuf.
  const t = { id: 'a', status: 'pending', created_at: ilYA(1) };
  assert.equal(doitAfficher(t, 'a:pending', MAINTENANT), false);
  assert.equal(doitAfficher({ ...t, status: 'running' }, 'a:pending', MAINTENANT), true);
});
