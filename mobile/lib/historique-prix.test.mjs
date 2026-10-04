import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historiquePrix, echelleTemps, reperesPrix, lieuDe, prixAuKilo, moinsChers } from './historique-prix.ts';

const l = (x) => ({ drive: 'carrefour', magasin: 'Carrefour Lattes', commande: '1', quantity_delivered: 1, unit_price_ttc: 5.55, remise_ttc: 0, total_ttc: 5.55, ...x });
// Le papier toilette Essential, tel que sur les factures.
const pq = [
  l({ purchase_date: '2023-03-14', quantity_delivered: 2, unit_price_ttc: 5.5, remise_ttc: -1.65, total_ttc: 9.35 }),
  l({ purchase_date: '2023-04-28', quantity_delivered: 2, unit_price_ttc: 5.55, remise_ttc: -1.67, total_ttc: 9.43 }),
  l({ purchase_date: '2023-07-23' }),
  l({ purchase_date: '2025-12-08', unit_price_ttc: 4.69, total_ttc: 4.69 }),
];

test('prix payé, remise et écart depuis le premier achat', () => {
  const h = historiquePrix(pq);
  assert.equal(h.achats.length, 4);
  assert.deepEqual(h.achats.map(a => a.paye), [4.68, 4.72, 5.55, 4.69]);
  assert.equal(h.achats[0].remise, 0.15);
  assert.equal(h.achats[0].lieu, 'Lattes');
  assert.equal(h.dernier.paye, 4.69);
  assert.equal(h.depuis, '2023-03-14');
  assert.equal(h.ecart, 0.002);
});

test('un produit manquant ne compte pas, un remplacement si', () => {
  const h = historiquePrix([l({ purchase_date: '2023-06-14', quantity_delivered: 0, total_ttc: 0 }), l({ purchase_date: '2023-06-15' })]);
  assert.deepEqual(h.achats.map(a => a.jour), ['2023-06-15']);
  assert.equal(h.ecart, null);
});

test('le relevé du drive complète, sans doubler la facture du même jour', () => {
  const h = historiquePrix(pq, [
    { vu_le: '2025-12-08T09:00:00Z', drive: 'carrefour', prix: 4.99, promotion: null },
    { vu_le: '2026-09-30T09:00:00Z', drive: 'leclerc', prix: 4.2, promotion: null },
    { vu_le: '2026-09-30T09:05:00Z', drive: 'leclerc', prix: 4.2, promotion: null },
  ]);
  assert.equal(h.achats.length, 5);
  assert.deepEqual(h.dernier, { jour: '2026-09-30', drive: 'leclerc', lieu: 'E.Leclerc', affiche: 4.2, paye: 4.2, quantite: 1, remise: 0, releve: true });
});

test('deux lignes du même jour se regroupent', () => {
  const h = historiquePrix([l({ purchase_date: '2023-06-14', unit_price_ttc: 2, total_ttc: 2 }), l({ commande: '2', purchase_date: '2023-06-14', unit_price_ttc: 4, total_ttc: 4 })]);
  assert.equal(h.achats.length, 1);
  assert.equal(h.achats[0].paye, 3);
  assert.equal(h.achats[0].quantite, 2);
});

test('le lieu se lit sans l’enseigne', () => {
  assert.equal(lieuDe('Carrefour Market Le Crès', 'carrefour'), 'Market Le Crès');
  assert.equal(lieuDe(null, 'leclerc'), 'E.Leclerc');
  assert.equal(lieuDe('Carrefour', 'carrefour'), 'Carrefour');
});

test('le temps se coupe sur un long trou', () => {
  const { x, coupures } = echelleTemps(pq.map(p => p.purchase_date));
  assert.equal(x('2023-03-14'), 0);
  assert.equal(x('2025-12-08'), 1);
  assert.equal(coupures.length, 1);
  assert.ok(coupures[0] > x('2023-07-23') && coupures[0] < 1);
  // Le trou de deux ans ne prend pas plus de place que le plus long écart ordinaire.
  assert.ok(1 - x('2023-07-23') < 0.5);
});

test('un seul achat se place au milieu', () => {
  assert.equal(echelleTemps(['2023-03-14']).x('2023-03-14'), 0.5);
});

test('repères ronds autour des prix', () => {
  const r = reperesPrix([4.68, 5.55, 4.69, 5.5]);
  assert.ok(r.min <= 4.68 && r.max >= 5.55);
  assert.ok(r.reperes.length >= 2 && r.reperes.length <= 5);
  assert.deepEqual(r.reperes, [4.5, 5, 5.5, 6].slice(0, r.reperes.length));
});

test('prix au kilo ou au litre, et les moins chers', () => {
  assert.deepEqual(prixAuKilo(1.05, 150, null), { valeur: 7, unite: 'kg' });
  assert.deepEqual(prixAuKilo(2.19, null, 600), { valeur: 3.65, unite: 'L' });
  assert.equal(prixAuKilo(2, null, null), null);
  assert.equal(prixAuKilo(null, 200, null), null);
  // On ne compare que des unités semblables ; un seul prix connu n'a pas de gagnant.
  assert.deepEqual(moinsChers([{ valeur: 7, unite: 'kg' }, { valeur: 5.2, unite: 'kg' }, null]), [1]);
  assert.deepEqual(moinsChers([{ valeur: 7, unite: 'kg' }, null]), []);
  assert.deepEqual(moinsChers([{ valeur: 7, unite: 'kg' }, { valeur: 3, unite: 'L' }]), []);
  assert.deepEqual(moinsChers([{ valeur: 4, unite: 'kg' }, { valeur: 4, unite: 'kg' }]), []);
});

test('le dernier prix payé de chaque produit', async () => {
  const { derniersPrix, quandAchete } = await import('./historique-prix.ts');
  const l = (x) => ({ purchase_date: '2025-12-08', drive: 'carrefour', magasin: null, commande: '1', quantity_delivered: 1, unit_price_ttc: 2.99, remise_ttc: 0, total_ttc: 2.99, product_id: 'a', ...x });
  const m = derniersPrix([
    l({ purchase_date: '2026-02-16', drive: 'leclerc', quantity_delivered: 2, unit_price_ttc: 1.5, remise_ttc: -0.6, total_ttc: 2.4 }),
    l({}), l({ product_id: 'b', quantity_delivered: 0 }), l({ product_id: null }),
  ]);
  assert.deepEqual(m.get('a'), { prix: 1.2, drive: 'leclerc', jour: '2026-02-16' });
  assert.equal(m.has('b'), false);
  assert.equal(quandAchete('2026-09-08', new Date('2026-10-04T12:00:00')), '8 sept.');
  assert.equal(quandAchete('2023-07-23', new Date('2026-10-04T12:00:00')), 'juil. 2023');
});
