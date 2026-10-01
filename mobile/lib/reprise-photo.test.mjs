import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phaseReprise, estPhotoOpenFoodFacts, DUREE_MAX_MS } from './reprise-photo.ts';

const base = { image_url: 'https://images.openfoodfacts.org/images/products/329/207/000/8858/front_fr.49.400.jpg', image_originale: null, image_reprise: null, reprise_statut: null, reprise_le: null };

test('estPhotoOpenFoodFacts : seulement les photos Open Food Facts', () => {
 assert.equal(estPhotoOpenFoodFacts(base.image_url), true);
 assert.equal(estPhotoOpenFoodFacts('https://qmymwicsgilhoihtfdjm.supabase.co/storage/v1/object/public/images-produits/x.png'), false);
 assert.equal(estPhotoOpenFoodFacts('https://evil.example/openfoodfacts.org/x.jpg'), false);
 assert.equal(estPhotoOpenFoodFacts(null), false);
});

test('phaseReprise : du bouton au choix, et une reprise bloquée devient un échec', () => {
 const t = Date.parse('2026-10-01T10:00:00Z');
 assert.equal(phaseReprise(base, t), 'proposer');
 assert.equal(phaseReprise({ ...base, image_url: 'https://x.supabase.co/a.png' }, t), 'rien');
 assert.equal(phaseReprise({ ...base, reprise_statut: 'en_cours', reprise_le: new Date(t - 20_000).toISOString() }, t), 'en_cours');
 assert.equal(phaseReprise({ ...base, reprise_statut: 'en_cours', reprise_le: new Date(t - DUREE_MAX_MS - 1).toISOString() }, t), 'echec');
 assert.equal(phaseReprise({ ...base, reprise_statut: 'prete', image_reprise: 'https://x/r.png' }, t), 'choisir');
 assert.equal(phaseReprise({ ...base, reprise_statut: 'prete', image_reprise: null }, t), 'proposer');
 assert.equal(phaseReprise({ ...base, reprise_statut: 'echec' }, t), 'echec');
 assert.equal(phaseReprise(null, t), 'rien');
});
