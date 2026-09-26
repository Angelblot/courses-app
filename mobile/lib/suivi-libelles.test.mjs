/**
 * Textes de l'écran de suivi. Fonctions pures, sans réseau.
 * Lancer : node --test mobile/lib/suivi-libelles.test.mjs   (Node >= 22)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { libelleEtat, resume } from './suivi-libelles.ts';

test('chaque état a une phrase française, jamais son code', () => {
  for (const s of ['pending', 'claimed', 'running', 'needs_action', 'done', 'failed', 'cancelled']) {
    const t = libelleEtat(s);
    assert.ok(t.length > 0, `état sans libellé : ${s}`);
    assert.ok(!t.includes(s), `le code technique fuit dans le libellé : ${t}`);
  }
});

test("un état inconnu ne casse pas l'écran", () => {
  assert.ok(libelleEtat('quelque_chose').length > 0);
});

test("le résumé en cours indique l'enseigne et l'avancement", () => {
  const t = resume({ status: 'running', progress: { drive: 'carrefour', fait: 12, total: 34 } });
  assert.match(t, /12/);
  assert.match(t, /34/);
  assert.match(t, /Carrefour/);
});

test("le résumé en attente ne prétend pas que ça avance", () => {
  const t = resume({ status: 'pending', progress: {} });
  assert.ok(!/\d+ sur \d+/.test(t), `progression inventée : ${t}`);
});

test('un travail à reprendre le dit clairement', () => {
  const t = resume({ status: 'needs_action', progress: {}, error: 'Vérification demandée sur Carrefour.' });
  assert.match(t, /Carrefour/);
});
