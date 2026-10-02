import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commandesDesFactures, commandesDesPaniers, toutesCommandes, comparerHistorique, comparerDrives } from './commandes.ts';

const f = (x) => ({ commande: 'A', purchase_date: '2023-07-23', drive: 'carrefour', magasin: 'Carrefour Lattes', product_id: null, ean13: null, libelle: 'x', quantity_delivered: 1, total_ttc: 1, unit_price_ttc: 1, ...x });
const factures = commandesDesFactures([
  f({ ean13: '1', product_id: 'pq', libelle: 'Papier toilette', total_ttc: 5.55, unit_price_ttc: 5.55 }),
  f({ ean13: '2', product_id: 'oig', libelle: 'Oignons', total_ttc: 0.89, unit_price_ttc: 0.89 }),
  f({ ean13: '3', libelle: 'Manquant', quantity_delivered: 0, total_ttc: 0 }),
  f({ commande: 'B', purchase_date: '2025-12-08', ean13: '1', product_id: 'pq', libelle: 'Papier toilette', total_ttc: 4.69, unit_price_ttc: 4.69 }),
  f({ commande: 'B', purchase_date: '2025-12-08', ean13: '2', product_id: 'oig', libelle: 'Oignons', total_ttc: 2.66, quantity_delivered: 2, unit_price_ttc: 1.33 }),
  f({ commande: 'B', purchase_date: '2025-12-08', ean13: '9', libelle: 'Nouveau', total_ttc: 3, unit_price_ttc: 3 }),
  f({ commande: 'B', purchase_date: '2025-12-08', ean13: '5', product_id: 'pan', libelle: 'Pancetta', total_ttc: 2, unit_price_ttc: 2 }),
  f({ commande: 'A', ean13: '5', product_id: 'pan', libelle: 'Pancetta', total_ttc: 2, unit_price_ttc: 2 }),
]);

test('une commande par facture, sans les produits non livrés', () => {
  assert.equal(factures.length, 2);
  const a = factures.find(c => c.id === 'facture:A');
  assert.equal(a.lignes.length, 3);
  assert.equal(a.total, 8.44);
  assert.equal(a.lieu, 'Carrefour Lattes');
});

test('comparaison avec le dernier achat de chaque produit', () => {
  const b = factures.find(c => c.id === 'facture:B');
  const r = comparerHistorique(b, factures);
  assert.equal(r.communs, 3);
  assert.equal(r.nouveaux, 1);
  assert.equal(r.totalAvant, 8.44);
  assert.equal(r.totalMaintenant, 8.02);
  assert.equal(r.ecart, -0.05);
  assert.deepEqual([r.baisses, r.stables, r.hausses], [1, 1, 1]);
  assert.equal(r.evolutions[0].ligne.libelle, 'Oignons');
  assert.equal(r.evolutions[0].ecart, 0.494);
  assert.equal(r.evolutions[0].avant.jour, '2023-07-23');
});

const travail = {
  id: 'j1', status: 'done', created_at: '2026-09-30T18:00:00Z', finished_at: '2026-09-30T18:20:00Z',
  results: {
    carrefour: [
      { item: 'papier toilette', ok: true, quantity: 1, label: 'Papier toilette Essential', product_id: 'pq', prix: 4.59 },
      { item: 'oignons', ok: true, quantity: 1, label: 'Oignons jaunes' },
      { item: 'pancetta', ok: false },
    ],
    leclerc: [
      { item: 'papier toilette', ok: true, quantity: 1, label: 'Papier toilette Marque Repère', product_id: 'pq', prix: 4.35 },
      { item: 'oignons', ok: true, quantity: 1, label: 'Oignons jaunes filet', product_id: 'oig', prix: 1.49 },
      { item: 'pancetta', ok: true, quantity: 1, label: 'Pancetta Leclerc', product_id: 'pan', prix: 2.2 },
    ],
  },
};
const offres = [{ cart_job_id: 'j1', drive: 'carrefour', product_id: 'oig', libelle: 'Oignons  jaunes', ean13: '2', prix: 1.29 }];

test('un panier rempli devient une commande, prix du compte rendu ou de l’offre choisie', () => {
  const [p] = commandesDesPaniers([travail, { ...travail, id: 'j2', status: 'failed' }], offres);
  assert.equal(p.id, 'panier:j1');
  assert.equal(p.jour, '2026-09-30');
  assert.deepEqual(p.drives, ['carrefour', 'leclerc']);
  assert.equal(p.lieu, 'Carrefour et E.Leclerc');
  assert.equal(p.lignes.length, 5);
  assert.equal(p.lignes.find(l => l.libelle === 'Oignons jaunes').prix, 1.29);
  assert.equal(p.total, 13.92);
});

test('comparaison d’un drive du panier avec l’historique', () => {
  const [p] = commandesDesPaniers([travail], offres);
  const r = comparerHistorique(p, toutesCommandes(factures, [p]), 'leclerc');
  assert.equal(r.communs, 3);
  assert.equal(r.evolutions.find(e => e.ligne.product_id === 'pq').avant.prix, 4.69);
});

test('le panier suivi de sa facture disparaît au profit de la facture', () => {
  const [p] = commandesDesPaniers([{ ...travail, finished_at: '2025-12-05T10:00:00Z' }], offres);
  const toutes = toutesCommandes(factures, [p]);
  assert.deepEqual(toutes.map(c => c.id), ['facture:B', 'facture:A']);
  const [q] = commandesDesPaniers([travail], offres);
  assert.deepEqual(toutesCommandes(factures, [q]).map(c => c.id), ['panier:j1', 'facture:B', 'facture:A']);
});

test('face à face entre drives : totaux, gagnant et manques', () => {
  const [p] = commandesDesPaniers([travail], offres);
  const r = comparerDrives(p);
  assert.equal(r.communs.length, 2);
  assert.deepEqual(r.totaux, { carrefour: 5.88, leclerc: 5.84 });
  assert.equal(r.moinsCher, 'leclerc');
  assert.equal(r.economie, 0.04);
  assert.deepEqual(r.victoires, { carrefour: 1, leclerc: 1 });
  assert.deepEqual(r.seulement.leclerc.map(l => l.libelle), ['Pancetta Leclerc']);
});

test('une alternative sur un drive se compare à la référence de l’autre', () => {
  const [p] = commandesDesPaniers([{ ...travail, results: {
    carrefour: [{ item: 'Emmental râpé', ok: true, label: 'Emmental Carrefour', product_id: 'emm', prix: 2.78 }],
    leclerc: [{ item: 'Emmental râpé', ok: true, label: 'Emmental Marque Repère', product_id: 'emm-mr', prix: 2.49 }],
  } }], []);
  const r = comparerDrives(p);
  assert.equal(r.communs.length, 1);
  assert.equal(r.communs[0].libelles.leclerc, 'Emmental Marque Repère');
  assert.equal(r.moinsCher, 'leclerc');
  assert.equal(r.economie, 0.29);
});
