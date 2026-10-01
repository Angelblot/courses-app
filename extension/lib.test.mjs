/**
 * Logique pure du pont Supabase : expiration de session et choix de la voie
 * d'accès à un produit. Aucun appel réseau ici.
 * Lancer : node --test extension/lib.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estExpire, entetes } from './lib/session.js';
import { strategie, indexer } from './lib/equivalences.js';
import { candidats, quantitePour } from './lib/alternatives.js';

const MAINTENANT = 1_700_000_000_000;

test('une session absente est considérée expirée', () => {
  assert.equal(estExpire(null, MAINTENANT), true);
  assert.equal(estExpire({}, MAINTENANT), true);
});

test("une session encore valable une heure ne l'est pas", () => {
  assert.equal(estExpire({ expire_le: MAINTENANT + 3_600_000 }, MAINTENANT), false);
});

test("une session qui expire dans moins d'une minute est renouvelée d'avance", () => {
  // Rafraîchir au dernier moment ferait échouer la requête en vol : le jeton
  // peut expirer entre la vérification et l'arrivée au serveur.
  assert.equal(estExpire({ expire_le: MAINTENANT + 30_000 }, MAINTENANT), true);
  assert.equal(estExpire({ expire_le: MAINTENANT - 1 }, MAINTENANT), true);
});

test('les en-têtes portent la clé publiable et le jeton', () => {
  const h = entetes({ jeton: 'abc' }, 'cle-publique');
  assert.equal(h.apikey, 'cle-publique');
  assert.equal(h.Authorization, 'Bearer abc');
  assert.equal(h['Content-Type'], 'application/json');
});

test('une adresse de fiche mémorisée court-circuite la recherche', () => {
  const s = strategie({ product_url: 'https://x/p/1', matched_label: 'Lardons', unavailable: false });
  assert.deepEqual(s, { voie: 'url', valeur: 'https://x/p/1' });
});

test("à défaut d'adresse, le libellé exact est retenu", () => {
  // C'est la seule voie chez Leclerc, dont les liens produit n'ont pas
  // d'adresse lisible.
  const s = strategie({ product_url: null, matched_label: 'Lardons fumés BIO', unavailable: false });
  assert.deepEqual(s, { voie: 'label', valeur: 'Lardons fumés BIO' });
});

test('un produit marqué indisponible est écarté, pas cherché', () => {
  const s = strategie({ product_url: 'https://x', matched_label: 'X', unavailable: true });
  assert.equal(s.voie, 'absent');
});

test('sans équivalence mémorisée, on retombe sur la recherche', () => {
  assert.deepEqual(strategie(null), { voie: 'recherche', valeur: null });
  assert.deepEqual(strategie({ product_url: null, matched_label: null, unavailable: false }),
    { voie: 'recherche', valeur: null });
});

test('les équivalences sont indexées par produit', () => {
  const m = indexer([
    { product_id: 'p1', matched_label: 'A' },
    { product_id: 'p2', matched_label: 'B' },
  ]);
  assert.equal(m.get('p1').matched_label, 'A');
  assert.equal(m.size, 2);
});

test('indexer tolère une liste vide ou absente', () => {
  assert.equal(indexer([]).size, 0);
  assert.equal(indexer(null).size, 0);
});

test('alternatives : la référence d\'abord, puis les alternatives vendues chez cette enseigne', () => {
  const item = {
    name: 'Emmental râpé', quantity: 1, ean: '1', product_id: 'e', enseigne: 'carrefour', grammage_g: 200,
    alternatives: [
      { product_id: 'g', name: 'Gruyère râpé', ean13: '2', enseigne: 'leclerc', grammage_g: 100 },
      { product_id: 'p', name: 'Parmesan râpé', ean13: '3', enseigne: null, grammage_g: 70 },
    ],
  };
  assert.deepEqual(candidats(item, 'carrefour').map((c) => c.product_id), ['e', 'p']);
  // Chez Leclerc, la marque Carrefour est sautée d'office.
  const leclerc = candidats(item, 'leclerc');
  assert.deepEqual(leclerc.map((c) => c.product_id), ['g', 'p']);
  assert.equal(leclerc[0].quantity, 2);
  assert.equal(leclerc[0].remplace, 'Emmental râpé');
  assert.equal(leclerc[1].quantity, 3);
});

test('quantité : même total quand les formats se comparent, sinon article pour article', () => {
  assert.equal(quantitePour({ grammage_g: 200 }, { grammage_g: 100 }, 1), 2);
  assert.equal(quantitePour({ volume_ml: 1000 }, { volume_ml: 1500 }, 3), 2);
  assert.equal(quantitePour({ grammage_g: 200 }, { volume_ml: 500 }, 2), 2);
  assert.equal(quantitePour({}, {}, 0), 1);
});
