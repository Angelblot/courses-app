import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dejaAchetes, histoireDe } from './deja-achete.ts';

const offre = (id, drive, libelle, extra = {}) => ({ id, recherche_id: 'r', drive, libelle, marque: null, ean13: null, url: null, image_url: null, prix: 2, prix_unitaire: null, unite_prix: null, grammage_g: null, volume_ml: null, nutriscore: null, promotion: null, disponible: true, rang: 0, vu_le: '', ...extra });
const florelli = { id: 'p1', name: 'Gressins Florelli Au Sésame 300g', ean13: '3000000000011', image_url: 'https://x/f.jpg' };
const tokapi = { id: 'p2', name: 'Gressins Tokapi Sésame 125g', ean13: null, image_url: null };

test('l’historique se dit en une ligne', () => {
  assert.equal(histoireDe([]), 'Dans tes produits');
  assert.equal(histoireDe([{ date: '2026-09-12' }]), 'Acheté une fois · dernier le 12 sept.');
  assert.equal(histoireDe([{ date: '2026-08-02' }, { date: '2026-09-12' }, { date: null }]), 'Acheté 3 fois · dernier le 12 sept.');
});

test('un produit est reconnu par son code-barres, puis par le libellé d’une commande ou d’un panier', () => {
  const offres = [offre('c1', 'carrefour', 'FLORELLI Gressins', { ean13: '3000000000011' }), offre('l1', 'leclerc', 'Gressins Tokapi Sésame - 125g'), offre('l2', 'leclerc', 'Gressins Repère')];
  const achats = [{ product_id: 'p2', drive: 'leclerc', libelle: 'Gressins Tokapi Sésame 125g', ean13: null, prix: 1.15, date: '2026-08-28' }];
  const c = dejaAchetes('carrefour', offres, [florelli, tokapi], achats, [], []);
  assert.deepEqual(c.map(x => [x.produit.id, x.offre.id, x.absent]), [['p1', 'c1', false]]);
  assert.equal(c[0].offre.produit_id, 'p1');
  const l = dejaAchetes('leclerc', offres, [florelli, tokapi], achats, [], []);
  assert.deepEqual(l.map(x => [x.produit.id, x.offre.id]), [['p2', 'l1']]);
  assert.equal(l[0].offre.histoire, 'Acheté une fois · dernier le 28 août');
  const lien = [{ product_id: 'p2', drive: 'leclerc', matched_label: 'Gressins Repère', product_url: null, ean13: null }];
  assert.equal(dejaAchetes('leclerc', [offres[2]], [tokapi], [], lien, [])[0].offre.id, 'l2');
});

test('acheté là mais absent des résultats : proposé avec son dernier prix, s’il est proche du nom cherché', () => {
  const achats = [{ product_id: 'p2', drive: 'leclerc', libelle: 'Tokapi', ean13: null, prix: 1.09, date: '2026-07-01' }, { product_id: 'p2', drive: 'leclerc', libelle: 'Tokapi', ean13: null, prix: 1.15, date: '2026-08-28' }];
  assert.deepEqual(dejaAchetes('leclerc', [], [tokapi], achats, [], []), []);
  const [c] = dejaAchetes('leclerc', [], [tokapi], achats, [], ['p2']);
  assert.equal(c.absent, true); assert.equal(c.offre.historique, true); assert.equal(c.offre.prix, 1.15); assert.equal(c.offre.drive, 'leclerc');
});

test('reconnus avant absents, les plus achetés d’abord, une offre pour un seul produit', () => {
  const offres = [offre('l1', 'leclerc', 'A', { ean13: '1' })];
  const a = { id: 'a', name: 'A', ean13: '1', image_url: null }, b = { id: 'b', name: 'B', ean13: '1', image_url: null }, c = { id: 'c', name: 'C', ean13: null, image_url: null };
  const achats = [{ product_id: 'c', drive: 'leclerc', libelle: 'C', ean13: null, prix: 1, date: '2026-01-01' }, { product_id: 'c', drive: 'leclerc', libelle: 'C', ean13: null, prix: 1, date: '2026-02-01' }];
  const r = dejaAchetes('leclerc', offres, [a, b, c], achats, [], ['c']);
  assert.deepEqual(r.map(x => [x.produit.id, x.absent]), [['a', false], ['c', true]]);
});
