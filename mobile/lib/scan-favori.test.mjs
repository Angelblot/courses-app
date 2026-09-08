import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enregistrerScanFavori } from './scan-favori.ts';

test('un nouveau produit est enregistré une seule fois', async () => {
  const fiche = { ean13: '1234567890123', name: 'Lait' };
  let insertions = 0;
  const r = await enregistrerScanFavori(fiche, async (f) => {
    assert.equal(f, fiche); insertions++; return { ok: true };
  }, async () => assert.fail('Pas de deuxième écriture nécessaire'));
  assert.equal(r.ok, true);
  assert.equal(insertions, 1);
});

test('rescanner un produit retiré des favoris le réactive sans remplacer sa photo ou son nom', async () => {
  const ecritures = [];
  const r = await enregistrerScanFavori({}, async () => ({
    ok: false, doublon: { id: 'existant', favorite: false },
  }), async (...args) => { ecritures.push(args); return { ok: true }; });
  assert.equal(r.ok, true);
  assert.deepEqual(ecritures, [['existant', true]]);
});

test('un produit déjà favori est un succès sans écriture supplémentaire', async () => {
  const r = await enregistrerScanFavori({}, async () => ({
    ok: false, doublon: { id: 'existant', favorite: true },
  }), async () => assert.fail('Le favori existe déjà'));
  assert.equal(r.ok, true);
});

test('une coupure pendant la réactivation reste éligible à la file hors ligne', async () => {
  const r = await enregistrerScanFavori({}, async () => ({
    ok: false, doublon: { id: 'existant', favorite: false },
  }), async () => ({ ok: false, reseau: true }));
  assert.deepEqual(r, { ok: false, reseau: true });
});

test('un refus serveur ne devient pas un faux succès ou un scan hors ligne', async () => {
  const refus = { ok: false, erreur: 'Accès refusé', reseau: false };
  assert.deepEqual(await enregistrerScanFavori({}, async () => refus,
    async () => assert.fail('Ne pas poursuivre après le refus')), refus);
});
