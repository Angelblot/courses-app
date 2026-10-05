import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ficheDepuisDrives } from './fiche-drive.ts';

const aujourdhui = new Date('2026-10-05T12:00:00');
const offre = { drive: 'carrefour', libelle: 'Gel intime Saforelle 250ml', marque: 'Saforelle', image_url: 'https://x/img.jpg',
  prix: '6.49', grammage_g: null, volume_ml: '250', nutriscore: null, vu_le: '2026-09-12T10:00:00Z' };

test('fiche des drives : rien de vu, pas de fiche', () => {
  assert.equal(ficheDepuisDrives('123', [], [], aujourdhui), null);
  assert.equal(ficheDepuisDrives('123', [{ ...offre, libelle: '  ' }], [{ drive: 'leclerc', libelle: null, unit_price_ttc: 2, purchase_date: '2026-09-01' }], aujourdhui), null);
});

test('fiche des drives : une offre relevée donne nom, photo, contenance et « Vu chez »', () => {
  const f = ficheDepuisDrives('3401', [offre], [], aujourdhui);
  assert.equal(f.name, 'Gel intime Saforelle 250ml');
  assert.equal(f.brand, 'Saforelle');
  assert.equal(f.imageUrl, 'https://x/img.jpg');
  assert.equal(f.volumeMl, 250);
  assert.equal(f.grammageG, null);
  assert.equal(f.ean13, '3401');
  assert.equal(f.origine, 'Vu chez Carrefour · 12 sept. · 6,49 €');
});

test('fiche des drives : un achat plus récent donne la mention, l’offre garde le nom', () => {
  const f = ficheDepuisDrives('3401', [offre], [{ drive: 'leclerc', libelle: 'GEL INTIME SAFO', unit_price_ttc: 5.9, purchase_date: '2026-09-30' }], aujourdhui);
  assert.equal(f.name, 'Gel intime Saforelle 250ml');
  assert.equal(f.origine, 'Vu chez E.Leclerc · 30 sept. · 5,90 €');
});

test('fiche des drives : une facture seule suffit, sans prix si elle n’en a pas', () => {
  const f = ficheDepuisDrives('3401', [], [{ drive: 'leclerc', libelle: 'GEL INTIME SAFO', unit_price_ttc: null, purchase_date: '2025-06-02' }], aujourdhui);
  assert.equal(f.name, 'GEL INTIME SAFO');
  assert.equal(f.imageUrl, null);
  assert.equal(f.origine, 'Vu chez E.Leclerc · juin 2025');
});
