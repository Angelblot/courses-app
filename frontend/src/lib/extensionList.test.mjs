// Lancer : node frontend/src/lib/extensionList.test.mjs
import { toExtensionList } from './extensionList.js';

let pass = 0; const fails = [];
const check = (label, a, e) => {
  JSON.stringify(a) === JSON.stringify(e) ? pass++ : fails.push(`${label}\n   attendu: ${JSON.stringify(e)}\n   obtenu : ${JSON.stringify(a)}`);
};

check('article comptable multiple',
  toExtensionList([{ name: 'Sauce tomate', quantity: 3, unit: 'piece' }]),
  'Sauce tomate x3');
check('un seul article : pas de suffixe',
  toExtensionList([{ name: 'Pain', quantity: 1, unit: 'piece' }]),
  'Pain');
check('grammage : jamais transformé en multiplicateur',
  toExtensionList([{ name: 'Lardons', quantity: 400, unit: 'g' }]),
  'Lardons');
check('volume : idem',
  toExtensionList([{ name: 'Lait', quantity: 1.5, unit: 'l' }]),
  'Lait');
check('unité vide traitée comme comptable',
  toExtensionList([{ name: 'Citron', quantity: 4, unit: '' }]),
  'Citron x4');
check('plusieurs lignes',
  toExtensionList([
    { name: 'Spaghetti', quantity: 2, unit: 'piece' },
    { name: 'Lardons', quantity: 200, unit: 'g' },
  ]),
  'Spaghetti x2\nLardons');

console.log(`\n${pass} vérification(s), ${fails.length} échec(s)\n`);
fails.forEach((f) => console.log('  ÉCHEC : ' + f + '\n'));
process.exit(fails.length ? 1 : 0);
