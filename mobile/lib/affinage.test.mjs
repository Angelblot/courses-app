import { test } from 'node:test';
import assert from 'node:assert/strict';
import { famille, requeteAffinee, correspond, marqueDe, suggestions, parleDe } from './affinage.ts';

const bieres = ['PELFORTH Bière Blonde 5,8% PELFORTH', 'BUD Bière Blonde 5% BUD', 'LEFFE Bière Blonde D\'Abbaye 6,6% LEFFE', 'LEFFE Bière Ruby 5% LEFFE',
  'HOEGAARDEN Bière Blanche 4,9% HOEGAARDEN', 'LA CHARNUE Bière IPA 5,5% LA CHARNUE', 'TOURTEL TWIST Bière Aromatisée Jus de Mangue Sans Alcool TOURTEL TWIST',
  'BARON DE LESTAC Vin Rouge A.O.P. Bordeaux BARON DE LESTAC', 'MOUTON CADET Vin Blanc A.O.P. Bordeaux MOUTON CADET',
  'Bière Desperados Pack de 6x33cl', 'Bière blanche Hilbörg 4,5%vol. - 6x25cl', 'Bière aromatisée Desperados Tropical - 6X33cl'].map(libelle => ({ libelle }));

test('la famille d’un article, et la recherche affinée', () => {
  assert.equal(famille('Bières'), 'biere');
  assert.equal(famille('Liquides vaisselle'), 'liquide vaisselle');
  assert.equal(famille('Eau de javel'), 'javel');
  assert.equal(famille('Papier sulfurisé'), null);
  assert.equal(famille('Epoisse'), null);
  assert.equal(requeteAffinee('Bières', 'IPA'), 'Bière IPA');
  assert.equal(requeteAffinee('Liquides vaisselle', 'Citron'), 'Liquide vaisselle Citron');
});

test('le filtre retrouve le type dans le libellé, accents et pluriels compris', () => {
  assert.ok(correspond('LA CHARNUE Bière IPA 5,5%', 'IPA'));
  assert.ok(correspond('Bière blanche Hilbörg', 'Blanche'));
  assert.ok(correspond('Tourtel Twist Sans Alcool', 'Sans alcool'));
  assert.ok(!correspond('LEFFE Bière Blonde', 'Blanche'));
  assert.ok(correspond('Infusion Fruits Rouges Menthe', 'Fruits rouges'));
});

test('la marque d’un libellé Carrefour, ou celle du drive', () => {
  assert.equal(marqueDe({ libelle: 'LEFFE Bière Blonde D\'Abbaye 6,6% LEFFE' }), 'LEFFE');
  assert.equal(marqueDe({ libelle: 'LA CHARNUE Bière IPA 5,5% LA CHARNUE' }), 'LA CHARNUE');
  assert.equal(marqueDe({ libelle: 'Bière Desperados Pack de 6x33cl' }), null);
  assert.equal(marqueDe({ libelle: 'x', marque: 'Desperados' }), 'Desperados');
});

test('les types de la famille d’abord, IPA compris ; les vins écartés ; les marques à part', () => {
  const { types, marques } = suggestions('Bières', bieres);
  assert.deepEqual(types.slice(0, 6).map(t => t.nom), ['IPA', 'Blonde', 'Blanche', 'Ambrée', 'Brune', 'Sans alcool']);
  assert.equal(types.find(t => t.nom === 'IPA').n, 1);
  assert.equal(types.find(t => t.nom === 'Blonde').n, 3);
  assert.equal(types.find(t => t.nom === 'Blanche').n, 2);
  assert.deepEqual(marques.map(m => m.nom), ['Leffe']);
  assert.ok(!types.some(t => /vin|bordeaux/i.test(t.nom)));
});

test('sans famille connue, les mots qui reviennent dans les libellés', () => {
  const { types } = suggestions('Gressin', ['FLORELLI Gressins Sésame FLORELLI', 'Gressins au sésame Florelli - 250g', 'CIRO Gressins au Romarin CIRO', 'FLORELLI Gressins Romarin FLORELLI', 'Gressins Tokapi Sésame - 125g'].map(libelle => ({ libelle })));
  assert.ok(types.some(t => t.nom === 'Sésame' && t.n === 3));
  assert.ok(types.some(t => t.nom === 'Romarin' && t.n === 2));
});

test('ce que le drive renvoie faute de mieux ne parle pas de l’article', () => {
  assert.ok(parleDe('REFLETS DE FRANCE Brie de Meaux AOP', 'Brie'));
  assert.ok(parleDe('Bière blonde IPA Brooklyn', 'Bières'));
  assert.ok(!parleDe('Escalope de poulet Le Gaulois 240g', 'Brie'));
  assert.ok(!parleDe('Oignon jaune 1p', 'Brie'));
});
