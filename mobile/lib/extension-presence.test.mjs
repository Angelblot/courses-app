import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireExtension, texteExtension, depuis } from './extension-presence.ts';

const T = Date.parse('2026-10-05T13:00:00Z');
const ligne = (activite, ilYaMin, detail = {}) => ({ activite, vue_le: new Date(T - ilYaMin * 60_000).toISOString(), detail });

test('extension : jamais vue, absente au-delà de trois minutes, prête sinon', () => {
  assert.deepEqual(lireExtension(null, T), { etat: 'jamais' });
  assert.deepEqual(lireExtension(ligne('prete', 2), T), { etat: 'prete', auto: true });
  assert.deepEqual(lireExtension(ligne('prete', 2, { auto: false }), T), { etat: 'prete', auto: false });
  assert.deepEqual(lireExtension(ligne('recherches', 12, { fait: 3, total: 34 }), T), { etat: 'absente', depuis: 'il y a 12 min' });
});

test('extension : une séance qui avance, et la pause qui attend une main', () => {
  assert.deepEqual(lireExtension(ligne('recherches', 0, { fait: 3, total: 34, drive: 'carrefour', requete: 'Gel intime' }), T),
    { etat: 'recherches', fait: 3, total: 34, drive: 'carrefour', requete: 'Gel intime' });
  assert.deepEqual(lireExtension(ligne('pause', 1, {}), T), { etat: 'pause', message: 'Une action t’attend sur ton ordinateur.' });
});

test('extension : la consigne dit quel bouton cliquer selon ce qui est confié', () => {
  assert.equal(texteExtension({ etat: 'prete', auto: false }, 'recherches').consigne, 'Dans l’extension, clique sur « Lancer les recherches ».');
  assert.equal(texteExtension({ etat: 'prete', auto: true }, 'recherches').consigne, 'Les recherches partent d’elles-mêmes dans les 30 secondes.');
  // Le remplissage du panier reste toujours lancé à la main.
  assert.equal(texteExtension({ etat: 'prete', auto: true }, 'remplissage').consigne, 'Dans l’extension, clique sur « Remplir le panier ».');
  const r = texteExtension({ etat: 'recherches', fait: 3, total: 34, drive: 'leclerc', requete: 'Gel intime' }, 'recherches');
  assert.equal(r.titre, 'Recherche en cours · 3 sur 34');
  assert.equal(r.consigne, '« Gel intime » sur E.Leclerc, à rythme humain.');
  assert.equal(texteExtension({ etat: 'absente', depuis: 'il y a 2 h' }, 'recherches').titre, 'Ordinateur pas vu');
});

test('extension : depuis quand', () => {
  assert.equal(depuis(new Date(T - 90 * 60_000).toISOString(), T), 'il y a 2 h');
  assert.equal(depuis(new Date(T).toISOString(), T), 'il y a 0 min');
});
