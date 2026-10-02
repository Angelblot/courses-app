import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparer, frequence, pistes, achatsDesEnvois } from './comparateur.ts';

const NOW = '2026-10-02T10:00:00Z';
const o = (x) => ({ drive: 'carrefour', product_id: 'emm', recherche: 'emmental râpé', marque: null, ean13: null, prix: null, prix_unitaire: null, unite_prix: 'kg', grammage_g: null, nutriscore: null, disponible: true, choisi: false, vu_le: '2026-09-30T10:00:00Z', ...x });
const offres = [
 o({ libelle: 'Emmental râpé Carrefour 200 g', ean13: '356', marque: 'Carrefour', prix: 2.45, prix_unitaire: 12.25, grammage_g: 200, nutriscore: 'd', choisi: true }),
 o({ libelle: 'Emmental râpé Carrefour 200 g', ean13: '356', marque: 'Carrefour', prix: 2.6, prix_unitaire: 13, grammage_g: 200, nutriscore: 'd', vu_le: '2026-08-01T10:00:00Z' }),
 o({ libelle: 'Emmental râpé Carrefour 500 g', ean13: '357', marque: 'Carrefour', prix: 5.2, prix_unitaire: 10.4, grammage_g: 500, nutriscore: 'd' }),
 o({ libelle: 'Comté râpé 150 g', ean13: '358', marque: 'Entremont', prix: 2.9, prix_unitaire: 19.33, grammage_g: 150, nutriscore: 'd' }),
 o({ libelle: 'Mozzarella râpée 200 g', ean13: '359', marque: 'Galbani', prix: 2.5, prix_unitaire: 12.5, grammage_g: 200, nutriscore: 'c' }),
 o({ libelle: 'Râpé premier prix 200 g', ean13: '360', marque: 'Simpl', prix: 1.8, prix_unitaire: 9, grammage_g: 200, nutriscore: 'e' }),
 o({ libelle: 'Emmental râpé indispo', ean13: '361', prix: 1, prix_unitaire: 5, disponible: false }),
 o({ libelle: 'Autre produit', product_id: 'autre', prix_unitaire: 1 }),
];
const emmental = { id: 'emm', name: 'Emmental râpé', ean13: '356', nutriscore: 'd' };

test('comparer : la dernière offre de chaque produit, triée au kilo, la référence repérée', () => {
 const l = comparer(offres, emmental, { maintenant: NOW });
 assert.deepEqual(l.map(x => x.ean13), ['360', '357', '356', '359', '358', '361']);
 const ref = l.find(x => x.reference);
 assert.equal(ref.prix, 2.45);
 assert.equal(l.find(x => x.ean13 === '357').ecartPrix, -0.15);
 assert.equal(comparer(offres, emmental, { maintenant: '2027-06-01T00:00:00Z' }).length, 0);
});

test('fréquence ramenée à un an', () => {
 const achats = [{ product_id: 'emm', quantite: 2, le: '2026-07-04T00:00:00Z' }, { product_id: 'emm', quantite: 1, le: '2026-09-02T00:00:00Z' }];
 assert.deepEqual(frequence(achats, 'emm', NOW), { fois: 2, quantite: 3, parAn: 12.1 });
 assert.deepEqual(frequence(achats, 'x', NOW), { fois: 0, quantite: 0, parAn: 0 });
});

test('pistes : grand format, mieux noté ; le moins cher mais moins bien noté est écarté', () => {
 const achats = [{ product_id: 'emm', quantite: 2, le: '2026-07-04T00:00:00Z' }, { product_id: 'emm', quantite: 1, le: '2026-09-02T00:00:00Z' }];
 const p = pistes(offres, achats, [emmental], { maintenant: NOW });
 assert.deepEqual(p.map(x => [x.type, x.alternative.ean13]), [['format', '357'], ['nutrition', '359']]);
 assert.equal(p[0].economieAn, 4);
 assert.match(p[0].raison, /15 % moins cher au kilo/);
 assert.match(p[1].raison, /Nutri-Score C au lieu de D/);
 assert.deepEqual(pistes(offres, achats.slice(0, 1), [emmental], { maintenant: NOW }), []);
});

test('achats lus dans les envois terminés seulement', () => {
 const envois = [
  { status: 'done', created_at: '2026-09-01', items: [{ product_id: 'emm', quantity: 2 }, { name: 'libre', product_id: null }] },
  { status: 'failed', created_at: '2026-09-02', items: [{ product_id: 'emm', quantity: 1 }] },
 ];
 assert.deepEqual(achatsDesEnvois(envois), [{ product_id: 'emm', quantite: 2, le: '2026-09-01' }]);
});

test('nuage : une colonne par note, repères ronds, unité de la référence', async () => {
 const { nuage } = await import('./comparateur.ts');
 const { points, reperes, unite } = nuage(comparer(offres, emmental, { maintenant: NOW }));
 assert.equal(unite, 'kg');
 assert.deepEqual(reperes, [5, 10, 15, 20]);
 const ref = points.find(p => p.ligne.reference);
 assert.equal(ref.colonne, 3);
 assert.ok(ref.hauteur > 0.4 && ref.hauteur < 0.5);
 assert.equal(points.length, 5);
 assert.deepEqual(nuage([]).points, []);
});

test('rythme d\'achat en mots', async () => {
 const { rythme } = await import('./comparateur.ts');
 assert.equal(rythme(52), 'chaque semaine');
 assert.equal(rythme(12.1), 'environ une fois par mois');
 assert.equal(rythme(2), 'de temps en temps');
});
