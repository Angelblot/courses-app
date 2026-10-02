import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lirePrix, lirePrixUnitaire, lireContenance, lireNutriscore, estIndisponible, lirePromotion, prixAuKilo, offresDepuisReleve } from './lib/offres.js';

test('prix affichés', () => {
  assert.equal(lirePrix('2,45 €'), 2.45);
  assert.equal(lirePrix('2€45'), 2.45);
  assert.equal(lirePrix('Prix 12,9 € soit'), 12.9);
  assert.equal(lirePrix('pas de prix'), null);
  assert.equal(lirePrix('2,45 € 12,25 € / kg'), 2.45);
});

test('prix au kilo, au litre, à la pièce', () => {
  assert.deepEqual(lirePrixUnitaire('9,80 € / kg'), { valeur: 9.8, unite: 'kg' });
  assert.deepEqual(lirePrixUnitaire('1,25 €/L'), { valeur: 1.25, unite: 'l' });
  assert.deepEqual(lirePrixUnitaire('0,35 € la pièce'), { valeur: 0.35, unite: 'unite' });
  assert.equal(lirePrixUnitaire('2,45 €'), null);
});

test('contenances, lots compris', () => {
  assert.deepEqual(lireContenance('Emmental râpé 200 g'), { grammage_g: 200, nombre: 1 });
  assert.deepEqual(lireContenance('Lait 6 x 1 L'), { volume_ml: 6000, nombre: 6 });
  assert.deepEqual(lireContenance('Yaourts 4x125g'), { grammage_g: 500, nombre: 4 });
  assert.deepEqual(lireContenance('Vin 75 cl'), { volume_ml: 750, nombre: 1 });
  assert.deepEqual(lireContenance('Café 1,5 kg'), { grammage_g: 1500, nombre: 1 });
  assert.equal(lireContenance('Papier toilette'), null);
});

test('Nutri-Score, disponibilité, promotion', () => {
  assert.equal(lireNutriscore('Nutri-Score B'), 'b');
  assert.equal(lireNutriscore('nutriscore-c'), 'c');
  assert.equal(lireNutriscore('score'), null);
  assert.equal(estIndisponible('Produit indisponible'), true);
  assert.equal(estIndisponible('Ajouter au panier'), false);
  assert.equal(lirePromotion('-30 % sur le 2e'), '-30 % sur le 2e');
  assert.equal(lirePromotion('2+1 offert'), '2+1 offert');
  assert.deepEqual(prixAuKilo(2.5, { grammage_g: 200 }), { valeur: 12.5, unite: 'kg' });
});

test('relevé : une ligne par carte, sans doublon, le choix marqué', () => {
  const releve = [
    { label: 'Emmental râpé 200 g', prix: '2,45 €', texte: 'Emmental râpé 200 g 2,45 € 12,25 € / kg Nutri-Score D', ean: '3560071178345', href: 'https://www.carrefour.fr/p/x-3560071178345', image: 'https://img/e.jpg' },
    { label: 'Emmental râpé 200 g', prix: '2,45 €', texte: '', ean: '3560071178345' },
    { label: 'Gruyère râpé 100 g', prix: '1,99 €', texte: 'Indisponible', image: 'data:image/png' },
    { label: '  ' },
  ];
  const rows = offresDepuisReleve(releve, { drive: 'carrefour', recherche: 'fromage râpé', productId: 'p1', jobId: 'j1', choisi: 'Emmental râpé 200 g' });
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].prix, rows[0].prix_unitaire, rows[0].unite_prix, rows[0].grammage_g, rows[0].nutriscore, rows[0].choisi, rows[0].rang], [2.45, 12.25, 'kg', 200, 'd', true, 0]);
  assert.deepEqual([rows[1].prix_unitaire, rows[1].disponible, rows[1].image_url, rows[1].choisi], [19.9, false, null, false]);
  assert.deepEqual(offresDepuisReleve(null, { drive: 'carrefour', recherche: 'x' }), []);
});

test('le relevé d’une fiche produit marque le produit mis au panier', () => {
  const [ligne] = offresDepuisReleve(
    [{ label: 'Papier toilette Essential', href: 'https://www.carrefour.fr/p/papier-3560070150403', ean: '3560070150403', prix: '4,69 €', texte: '4,69 €', image: '', nutri: '' }],
    { drive: 'carrefour', recherche: 'papier toilette', productId: 'pq', jobId: 'j1', choisi: 'Papier toilette Essential' },
  );
  assert.equal(ligne.prix, 4.69);
  assert.equal(ligne.choisi, true);
  assert.equal(ligne.ean13, '3560070150403');
});
