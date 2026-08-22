/**
 * Vérifie la logique pure de l'extension : analyse de la liste saisie et score
 * de correspondance. Deux endroits où une erreur passe inaperçue — au pire un
 * mauvais produit finit dans le panier — et les seuls testables sans accéder
 * aux sites des enseignes.
 *
 * Lancer : node test-matching.mjs
 */

import { parseItems } from './lib/liste.js';

// --- Copies des aides internes de page-agent.js ---
//
// `pageAgent` est passé à `chrome.scripting.executeScript({func})`, qui le
// sérialise vers la page : il ne peut donc référencer aucun import, et ses
// aides doivent rester dupliquées ici. La dernière vérification garde-fou de
// ce fichier échoue si les copies divergent de l'original.
//
// `parseItems`, lui, vit dans un module ordinaire : il est importé, pas copié.

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
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

// --- Lignes contenant une URL de fiche produit ---
// Carrefour n'indexe pas les EAN dans sa recherche (0 résultat, vérifié le
// 18/08/2026) mais les expose dans l'URL : l'accès direct est donc le seul
// moyen sûr de viser un produit précis.

const URL_VIN = 'https://www.carrefour.fr/p/vin-blanc-igp-pays-d-oc-viognier-cibadies-3443660013046';

check(
  'une URL de fiche est reconnue, avec son EAN',
  parseItems(URL_VIN),
  [{
    name: 'vin blanc igp pays d oc viognier cibadies',
    quantity: 1,
    url: URL_VIN,
    ean: '3443660013046',
  }]
);

check(
  'une URL accepte aussi une quantité',
  parseItems(`${URL_VIN} x2`)[0].quantity,
  2
);

check(
  'un nom ordinaire ne produit ni url ni ean',
  parseItems('Lardons fumés')[0],
  { name: 'Lardons fumés', quantity: 1 }
);

checkTrue(
  'le motif d\'URL Carrefour extrait bien l\'EAN',
  /\/p\/[^/?#]*?-(\d{13})(?:[/?#]|$)/.exec(URL_VIN)?.[1] === '3443660013046'
);

check("le préfixe [EAN] de l'application est reconnu",
  parseItems('[3760040427577] Vin Blanc Viognier x2'),
  [{ name: 'Vin Blanc Viognier', quantity: 2, ean: '3760040427577' }]);
check('un nombre à 13 chiffres dans le nom ne devient pas un EAN',
  parseItems('Lot 1234567890123 pièces')[0].ean,
  undefined);

// --- Départage des quasi-homonymes ---

const AMBIGUITY_MARGIN = 0.05;


function extraTokens(wanted, candidate) {
  const w = new Set(normalize(wanted).split(' ').filter(Boolean));
  return normalize(candidate)
    .split(' ')
    .filter((t) => t.length > 2 && !w.has(t) && !STOP_WORDS.has(t) && !/^\d+$/.test(t)).length;
}

function rank(wanted, labels) {
  const tokens = normalize(wanted).split(' ').filter((t) => t && !STOP_WORDS.has(t));
  const corpus = labels.map((l) => normalize(l)).join(' ');
  const matched = tokens.filter((t) => corpus.includes(t));
  const missing = tokens.filter((t) => !corpus.includes(t));
  const head = tokens[0];
  const keep = Boolean(head) && corpus.includes(head);
  const effective = keep && matched.length ? matched.join(' ') : wanted;
  const ignored = keep ? missing : [];

  const ranked = labels
    .map((label) => ({ label, score: score(effective, label), extra: extraTokens(effective, label) }))
    .sort((a, b) => b.score - a.score || a.extra - b.extra || a.label.length - b.label.length);
  return { ranked, ignored };
}

/** Reproduit la décision de l'agent : meilleur, seuil, puis test d'ambiguïté. */
function decide(wanted, labels) {
  const { ranked, ignored } = rank(wanted, labels);
  const best = ranked[0];
  if (!best || best.score < MATCH_THRESHOLD) return { verdict: 'no_match' };
  const second = ranked[1];
  if (
    second &&
    second.score >= MATCH_THRESHOLD &&
    best.score - second.score < AMBIGUITY_MARGIN &&
    best.extra === second.extra
  ) {
    return {
      verdict: 'ambiguous',
      ignored,
      candidates: ranked.slice(0, 3).map((c) => c.label),
    };
  }
  return ignored.length
    ? { verdict: 'added', label: best.label, ignored }
    : { verdict: 'added', label: best.label };
}

const VARIANTES = [
  'Lardons Fumés HERTA',
  'Lardons Fumés BIO HERTA',
  'Lardons Fumés Allégés en sel HERTA',
];

check(
  'entre variantes, le produit le plus simple gagne',
  decide('Lardons fumés Herta', VARIANTES),
  { verdict: 'added', label: 'Lardons Fumés HERTA' }
);

check(
  'demander la variante bio la sélectionne',
  decide('Lardons fumés bio Herta', VARIANTES),
  { verdict: 'added', label: 'Lardons Fumés BIO HERTA' }
);

checkTrue(
  'deux marques également plausibles : on ne devine pas',
  decide('Lait demi-écrémé', ['Lait demi-écrémé Carrefour', 'Lait demi-écrémé Lactel'])
    .verdict === 'ambiguous'
);

checkTrue(
  'les mots superflus sont comptés hors chiffres et bruit',
  extraTokens('Lardons fumés', 'Lardons Fumés BIO 200 g') === 1,
  `obtenu ${extraTokens('Lardons fumés', 'Lardons Fumés BIO 200 g')}`
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

// --- Variantes réelles du drive Leclerc ---
// Relevées le 18/08/2026 sur une recherche « lardons » : quatre déclinaisons
// du même produit, qui ne diffèrent que par la variante et le format.

const LARDONS = [
  'Lardons supérieurs Tradilège\nNature - 2x100g',
  'Lardons supérieurs Tradilège\nNature - 160g',
  'Lardons supérieurs Tradilège\nFumés - 2x100g',
  'Lardons supérieurs Tradilège\nFumés maxi format 2x200g',
];

check(
  'la variante fumée est distinguée de la nature',
  decide('Lardons fumés', LARDONS),
  { verdict: 'added', label: LARDONS[2] }
);
check(
  'le format maxi est sélectionné quand il est demandé',
  decide('Lardons fumés maxi', LARDONS),
  { verdict: 'added', label: LARDONS[3] }
);
check(
  'le grammage départage deux variantes nature',
  decide('Lardons nature 160g', LARDONS),
  { verdict: 'added', label: LARDONS[1] }
);
checkTrue(
  '« lardons » seul est trop vague pour trancher',
  decide('Lardons', LARDONS).verdict === 'ambiguous'
);

// --- Franchissement de la frontière executeScript ---
// Les arguments d'executeScript sont sérialisés en JSON. Une RegExp y devient
// un objet vide, et tout appel à .test() dans la page lève une exception qui
// remonte en « page muette ». Ce bug a réellement cassé l'ajout au panier ;
// ces vérifications empêchent de le réintroduire.

const { SITES } = await import('./content/sites.js');

for (const [key, cfg] of Object.entries(SITES)) {
  const transmis = JSON.parse(JSON.stringify(cfg));

  checkTrue(
    `${key} : le motif d'URL produit survit à la sérialisation`,
    typeof transmis.productUrlPattern === 'string' && transmis.productUrlPattern.length > 0,
    `obtenu ${JSON.stringify(transmis.productUrlPattern)}`
  );

  checkTrue(
    `${key} : le motif recompilé est une expression régulière valide`,
    new RegExp(transmis.productUrlPattern) instanceof RegExp
  );

  // Tout ce que la page utilise doit traverser intact : un tableau de
  // sélecteurs vidé par la sérialisation passerait inaperçu.
  for (const champ of ['cards', 'title', 'price', 'addButton', 'cookieReject']) {
    checkTrue(
      `${key} : ${champ} traverse la sérialisation`,
      Array.isArray(transmis[champ]) && transmis[champ].length === cfg[champ].length
    );
  }
}

checkTrue(
  "le motif Carrefour extrait l'EAN d'une URL de fiche",
  new RegExp(SITES.carrefour.productUrlPattern).exec(
    'https://www.carrefour.fr/p/vin-blanc-cibadies-3443660013046'
  )?.[1] === '3443660013046'
);

checkTrue(
  'le motif Carrefour ignore une page de recherche',
  !new RegExp(SITES.carrefour.productUrlPattern).test('https://www.carrefour.fr/s?q=lardons')
);

checkTrue(
  'le motif Leclerc ignore une page de recherche de magasin',
  !new RegExp(SITES.leclerc.productUrlPattern).test(
    'https://fd3-courses.leclercdrive.fr/magasin-093401-093401-Le-Cres-Montpellier/recherche.aspx?TexteRecherche=lardons'
  )
);

// --- Marque absente du rayon, et grammages ---
// Cas réel signalé à l'usage : il fallait le nom exact. Une marque que le
// drive ne référence pas condamnait toute la liste, alors que le moteur du
// site avait déjà filtré.

check(
  "une marque absente du rayon est écartée, pas bloquante",
  decide('Lardons fumés Herta', LARDONS),
  { verdict: 'added', label: LARDONS[2], ignored: ['herta'] }
);

check(
  'sans terme écarté, rien n\'est signalé',
  decide('Lardons fumés', LARDONS),
  { verdict: 'added', label: LARDONS[2] }
);

checkTrue(
  '« 500g » et « 500 g » désignent le même grammage',
  score('Spaghetti 500g', 'Spaghetti Barilla 500 g') === 1,
  `score = ${score('Spaghetti 500g', 'Spaghetti Barilla 500 g').toFixed(2)}`
);

check(
  'le grammage collé au chiffre reste discriminant',
  decide('Lardons fumés 2x200g', LARDONS),
  { verdict: 'added', label: LARDONS[3] }
);

checkTrue(
  'une recherche sans rapport reste rejetée : on ne peut pas écarter le produit lui-même',
  decide('Saumon fumé Labeyrie', LARDONS).verdict === 'no_match',
  JSON.stringify(decide('Saumon fumé Labeyrie', LARDONS))
);
checkTrue(
  'écarter un seul qualificatif reste permis',
  decide('Lardons fumés Tradilège bio', LARDONS).verdict === 'added'
);
checkTrue(
  'un produit absent du rayon ne se rabat pas sur un voisin',
  decide('Jambon blanc Herta', LARDONS).verdict === 'no_match',
  JSON.stringify(decide('Jambon blanc Herta', LARDONS))
);

// --- Jambons réels du drive Leclerc ---
// Relevés le 18/08/2026 : 70 résultats pour « Jambon blanc Herta », dont
// aucun des premiers ne porte les mots « blanc » ni « Herta » — le site parle
// de « jambon supérieur ». Refuser ces résultats était un faux négatif.

const JAMBONS = [
  'Jambon Supérieur Fleury Michon sans nitrite x4 - 140g',
  'Jambon superieur 4 tranches Soutenons Nos Agriculteurs 140g',
  'Jambon supérieur 6 tranches Soutenons Nos Agriculteurs 210g',
  'Jambon supérieur 4T Tradilège Conservation sans nitrite-140g',
];

// Une marque introuvable au rayon rend les jambons restants indiscernables :
// on le dit, plutôt que d'en livrer un au hasard à la place du Herta demandé.
checkTrue(
  'sans la marque demandée, les jambons restants sont déclarés indiscernables',
  decide('Jambon blanc Herta', JAMBONS).verdict === 'ambiguous',
  JSON.stringify(decide('Jambon blanc Herta', JAMBONS))
);

checkTrue(
  "l'ambiguïté propose des candidats à choisir",
  decide('Jambon blanc Herta', JAMBONS).candidates?.length === 3
);

checkTrue(
  'les termes introuvables sont signalés',
  decide('Jambon blanc Herta', JAMBONS).ignored?.includes('herta') === true
);

checkTrue(
  "un saumon ne se rabat pas sur un jambon : le nom du produit est absent",
  decide('Saumon fumé Labeyrie', JAMBONS).verdict === 'no_match'
);

// Quand la marque est bien au rayon, elle doit l'emporter.
const JAMBONS_AVEC_HERTA = [...JAMBONS, 'Jambon Le Bon Paris HERTA 4 tranches 140g'];
check(
  'la marque demandée est retenue quand le rayon la propose',
  decide('Jambon blanc Herta', JAMBONS_AVEC_HERTA),
  { verdict: 'added', label: 'Jambon Le Bon Paris HERTA 4 tranches 140g', ignored: ['blanc'] }
);

// --- Verdict ---


// --- Garde-fou : les copies ne doivent pas diverger de l'original ---
//
// `pageAgent` est sérialisé vers la page par `chrome.scripting.executeScript` :
// il ne peut référencer aucun import, et ses aides internes doivent donc être
// dupliquées ici. Rien n'empêcherait alors les deux versions de diverger, et
// les vérifications ci-dessus porteraient sur une fiction.
//
// Ces contrôles comparent le texte des copies à celui de l'original, en
// ignorant commentaires et espaces. Ils échouent au premier écart de fond.
//
// `rank` et `decide` en sont exclus délibérément : la copie de `rank` travaille
// sur des libellés là où l'original manipule des objets de candidat, et
// `decide` n'existe que dans ce fichier pour modéliser la décision.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));

function extraireBloc(source, motif) {
  const m = source.match(motif);
  if (!m) return null;
  let profondeur = 0;
  let commence = false;
  for (let i = m.index; i < source.length; i += 1) {
    if (source[i] === '{') { profondeur += 1; commence = true; }
    else if (source[i] === '}') {
      profondeur -= 1;
      if (commence && profondeur === 0) return source.slice(m.index, i + 1);
    }
  }
  return null;
}

function extraireLigne(source, motif) {
  const m = source.match(motif);
  return m ? m[0] : null;
}

const sansBruit = (t) => (t ?? '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const original = readFileSync(join(ICI, 'content', 'page-agent.js'), 'utf8');
const copie = readFileSync(join(ICI, 'test-matching.mjs'), 'utf8');

const BLOCS = [
  ['normalize', /function normalize\(/],
  ['score', /function score\(/],
  ['extraTokens', /function extraTokens\(/],
];

for (const [nom, motif] of BLOCS) {
  const a = sansBruit(extraireBloc(original, motif));
  const b = sansBruit(extraireBloc(copie, motif));
  checkTrue(
    `copie de ${nom} conforme à page-agent.js`,
    a !== null && b !== null && a === b,
    a === b ? '' : `original : ${String(a).slice(0, 90)} | copie : ${String(b).slice(0, 90)}`,
  );
}

const LIGNES = [
  ['STOP_WORDS', /STOP_WORDS = new Set\(\[[^\]]*\]\)/],
  ['MATCH_THRESHOLD', /MATCH_THRESHOLD = [\d.]+/],
  ['AMBIGUITY_MARGIN', /AMBIGUITY_MARGIN = [\d.]+/],
];

for (const [nom, motif] of LIGNES) {
  const a = sansBruit(extraireLigne(original, motif));
  const b = sansBruit(extraireLigne(copie, motif));
  checkTrue(
    `copie de ${nom} conforme à page-agent.js`,
    a !== null && b !== null && a === b,
    a === b ? '' : `original : ${a} | copie : ${b}`,
  );
}

// --- Récapitulatif ---
console.log(`\n${passed} vérification(s) passée(s), ${failures.length} échec(s)\n`);
for (const f of failures) console.log(`  ÉCHEC : ${f}\n`);
process.exit(failures.length ? 1 : 0);
