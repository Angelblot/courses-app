/**
 * Vérifie la logique pure de l'extension : analyse de la liste saisie et score
 * de correspondance. Deux endroits où une erreur passe inaperçue — au pire un
 * mauvais produit finit dans le panier — et les seuls testables sans accéder
 * aux sites des enseignes.
 *
 * Lancer : node test-matching.mjs
 */

// --- Copies conformes des implémentations (popup.js / page-agent.js) ---

function parseItems(raw) {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)\s*[x×]\s*(\d+)$/i);
      if (m) return { name: m[1].trim(), quantity: Number(m[2]) };
      return { name: line, quantity: 1 };
    });
}

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set(['de', 'du', 'la', 'le', 'les', 'des', 'a', 'au', 'en', 'et']);

function score(wanted, candidate) {
  const w = normalize(wanted).split(' ').filter((t) => t && !STOP_WORDS.has(t));
  const c = normalize(candidate);
  if (!w.length || !c) return 0;
  const total = w.reduce((sum, t) => sum + t.length, 0);
  const hit = w.reduce((sum, t) => sum + (c.includes(t) ? t.length : 0), 0);
  return total ? hit / total : 0;
}

const MATCH_THRESHOLD = 0.75;

// --- Harnais minimal ---

let passed = 0;
const failures = [];

function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed += 1;
  else failures.push(`${label}\n    attendu : ${e}\n    obtenu  : ${a}`);
}

function checkTrue(label, condition, detail = '') {
  if (condition) passed += 1;
  else failures.push(`${label}${detail ? `\n    ${detail}` : ''}`);
}

// --- parseItems ---

check('ligne simple', parseItems('Lardons fumés'), [{ name: 'Lardons fumés', quantity: 1 }]);
check('quantité avec x', parseItems('Spaghetti 500g x2'), [{ name: 'Spaghetti 500g', quantity: 2 }]);
check('quantité avec ×', parseItems('Sauce tomate × 3'), [{ name: 'Sauce tomate', quantity: 3 }]);
check('lignes vides ignorées', parseItems('Pain\n\n  \nLait'), [
  { name: 'Pain', quantity: 1 },
  { name: 'Lait', quantity: 1 },
]);
check(
  'un grammage ne doit pas être pris pour une quantité',
  parseItems('Farine 1kg'),
  [{ name: 'Farine 1kg', quantity: 1 }]
);

// --- score ---

checkTrue(
  'correspondance exacte = 1',
  score('Spaghetti Barilla', 'Spaghetti Barilla n°5 500g') === 1,
  `score = ${score('Spaghetti Barilla', 'Spaghetti Barilla n°5 500g')}`
);
checkTrue(
  'insensible aux accents et à la casse',
  score('Lardons fumés', 'LARDONS FUMES nature 200g') === 1
);
checkTrue(
  'un roman ne doit pas passer pour des pâtes (cas observé sur Leclerc)',
  score('Spaghetti Barilla', 'Le Syndrome du spaghetti, roman') < MATCH_THRESHOLD,
  `score = ${score('Spaghetti Barilla', 'Le Syndrome du spaghetti, roman').toFixed(2)}`
);
checkTrue(
  'ni un objet de déco',
  score('Spaghetti Barilla', 'Boîte à Spaghetti en métal déco') < MATCH_THRESHOLD
);
checkTrue(
  'le vrai produit passe le seuil',
  score('Spaghetti Barilla', 'Spaghetti Barilla n°5 500g') >= MATCH_THRESHOLD
);
checkTrue(
  'variante de marque acceptée',
  score('Sauce tomate Panzani', 'Panzani sauce tomate basilic 400g') >= MATCH_THRESHOLD
);
checkTrue(
  'le bon produit doit battre le mauvais',
  score('Sauce tomate Panzani', 'Sauce tomate basilic Panzani 400g') >
    score('Sauce tomate Panzani', 'Boîte à spaghetti en métal')
);
checkTrue('libellé vide = 0', score('Pain', '') === 0);
checkTrue('recherche vide = 0', score('', 'Pain de mie') === 0);
checkTrue(
  'un produit voisin mais différent est rejeté',
  score('Pot de crème', 'Crème fraîche épaisse') < MATCH_THRESHOLD,
  `score = ${score('Pot de crème', 'Crème fraîche épaisse').toFixed(2)}`
);
checkTrue(
  'les mots outils ne comptent pas dans le score',
  score('Sauce de tomate', 'Sauce tomate 400g') === 1
);

// --- Sélection sur des titres Carrefour réels ---
// Relevés le 18/08/2026 par le mode diagnostic, retours à la ligne compris :
// le titre affiché répète la marque avant et après le libellé.

const CATALOGUE = [
  'LUSTUCRU\n\nPâtes Fraîches Tortellini Jambon Cru LUSTUCRU',
  'CARREFOUR EXTRA\n\nGorgonzola AOP CARREFOUR EXTRA',
  'HERTA\n\nPoitrine Fumée HERTA',
  'BRETS\n\nChips la craquante nature BRETS',
  "KELLOGG'S\n\nCéréales Trésor Chocolat au Lait KELLOGG'S",
];

/** Reproduit le choix de l'agent : meilleur score, puis seuil. */
function pick(query) {
  let best = null;
  for (const label of CATALOGUE) {
    const s = score(query, label);
    if (!best || s > best.s) best = { label, s };
  }
  return best.s >= MATCH_THRESHOLD ? best.label : null;
}

checkTrue(
  'les sauts de ligne du titre ne cassent pas le score',
  score('Poitrine fumée Herta', CATALOGUE[2]) === 1
);
check('marque + produit trouve la bonne ligne', pick('Poitrine fumée Herta'), CATALOGUE[2]);
check('libellé simple trouve la bonne ligne', pick('Gorgonzola'), CATALOGUE[1]);
check('tortellini', pick('Tortellini jambon cru Lustucru'), CATALOGUE[0]);
check(
  'un produit absent du catalogue ne renvoie rien plutôt qu\'un faux',
  pick('Saumon fumé'),
  null
);
check(
  'une marque seule ne suffit pas à choisir un produit au hasard',
  pick('Yaourt nature Carrefour'),
  null
);

// --- Verdict ---

console.log(`\n${passed} vérification(s) passée(s), ${failures.length} échec(s)\n`);
for (const f of failures) console.log(`  ÉCHEC : ${f}\n`);
process.exit(failures.length ? 1 : 0);
