import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saison, phraseSaison, dateLongue, salutation, resumeBudget } from './accueil.ts';

test('la saison et sa phrase suivent le mois', () => {
  assert.equal(saison(new Date('2026-10-04T10:00:00')), 'automne');
  assert.equal(saison(new Date('2026-12-15T10:00:00')), 'hiver');
  assert.equal(saison(new Date('2026-02-28T10:00:00')), 'hiver');
  assert.equal(saison(new Date('2026-03-01T10:00:00')), 'printemps');
  assert.equal(saison(new Date('2026-07-14T10:00:00')), 'ete');
  assert.match(phraseSaison(new Date('2026-10-04T10:00:00')), /automne/);
});

test('date et salutation', () => {
  assert.equal(dateLongue(new Date('2026-10-04T10:00:00')), 'Dimanche 4 octobre');
  assert.equal(salutation(new Date('2026-10-04T10:00:00')), 'Bonjour.');
  assert.equal(salutation(new Date('2026-10-04T19:30:00')), 'Bonsoir.');
});

test('le budget : moyenne des 6 dernières, écart avec les 6 d’avant', () => {
  const t = [232.07, 217.35, 206.45, 228.1, 189.14, 211.6, 239.7, 181.29, 235.08, 234.77, 242.63, 204];
  const jours = ['2025-08-01', '2025-09-01', '2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01', '2026-04-01', '2026-06-09', '2025-02-01', '2024-12-01', '2024-11-01', '2023-07-01'];
  const b = resumeBudget(t.map((total, i) => ({ jour: jours[i], total })).concat([{ jour: '2026-09-01', total: null }]));
  assert.equal(b.moyenne, 209);
  assert.equal(b.sur, 6);
  assert.equal(b.evolution, -0.08);
  assert.deepEqual(b.points, [232.07, 217.35, 206.45, 228.1, 189.14, 211.6, 239.7, 181.29]);
  assert.equal(resumeBudget([{ jour: '2026-01-01', total: 50 }]), null);
  assert.equal(resumeBudget([{ jour: '2026-01-01', total: 50 }, { jour: '2026-02-01', total: 70 }]).evolution, null);
});
