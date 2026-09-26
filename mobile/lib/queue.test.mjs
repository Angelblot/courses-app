/**
 * Vérifie la file d'attente hors connexion sur un stockage simulé.
 * Lancer : node --test mobile/lib/queue.test.mjs
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { creerFile } from './queue.ts';

/** Stockage en mémoire, à l'interface d'AsyncStorage. */
function stockageMemoire() {
  const m = new Map();
  return {
    getItem: async (k) => m.get(k) ?? null,
    setItem: async (k, v) => void m.set(k, v),
    removeItem: async (k) => void m.delete(k),
  };
}

let file;
beforeEach(() => { file = creerFile(stockageMemoire()); });

const fiche = (ean) => ({ ean13: ean, name: `Produit ${ean}`, brand: null,
  imageUrl: null, grammageG: null, volumeMl: null, productType: null });

test('une file neuve est vide', async () => {
  assert.equal(await file.taille(), 0);
  assert.deepEqual(await file.defiler(), []);
});

test('enfiler puis défiler restitue dans l\'ordre', async () => {
  await file.enfiler(fiche('1'));
  await file.enfiler(fiche('2'));
  const sorties = await file.defiler();
  assert.deepEqual(sorties.map((f) => f.ean13), ['1', '2']);
});

test('défiler ne vide pas la file', async () => {
  // Vider avant confirmation d'envoi perdrait les fiches en cas d'échec.
  await file.enfiler(fiche('1'));
  await file.defiler();
  assert.equal(await file.taille(), 1);
});

test('vider la file la remet à zéro', async () => {
  await file.enfiler(fiche('1'));
  await file.viderFile();
  assert.equal(await file.taille(), 0);
});

test('un même code-barres ne s\'accumule pas', async () => {
  await file.enfiler(fiche('1'));
  await file.enfiler(fiche('1'));
  assert.equal(await file.taille(), 1);
});

test('remplacer réécrit la file en une seule fois', async () => {
  await file.enfiler(fiche('1'));
  await file.enfiler(fiche('2'));
  await file.remplacer([fiche('2'), fiche('3')]);
  const sorties = await file.defiler();
  assert.deepEqual(sorties.map((f) => f.ean13), ['2', '3']);
});

test('remplacer par une liste vide vide la file', async () => {
  await file.enfiler(fiche('1'));
  await file.remplacer([]);
  assert.equal(await file.taille(), 0);
  assert.deepEqual(await file.defiler(), []);
});

test('un stockage corrompu est traité comme une file vide', async () => {
  const s = stockageMemoire();
  await s.setItem('courses.file_scan', 'ceci n\'est pas du json');
  const f = creerFile(s);
  assert.deepEqual(await f.defiler(), []);
});
