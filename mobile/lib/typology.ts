/**
 * Typologie automatique des produits, portée de product_typology.py.
 *
 * Extrait un type sémantique normalisé depuis le nom d'un produit, ce qui
 * permet de rapprocher un ingrédient de recette d'un produit du catalogue.
 */

/** (mots-clés, type associé). L'ordre compte : spécifique avant générique. */
const TYPE_RULES: Array<[string[], string]> = [
  // Charcuterie
  [['allumette', 'lardon', 'bacon', 'poitrine'], 'lardon'],
  [['chorizo', 'saucisson', 'saucisse', 'rosette'], 'charcuterie'],
  [['pancetta', 'coppa', 'prosciutto'], 'charcuterie'],
  // Pates & riz
  [['spaghetti', 'tortellini', 'gnocchi', 'tagliatelle', 'penne', 'fusilli'], 'pate'],
  [['coude', 'macaroni', 'farfalle', 'conchiglie'], 'pate'],
  [['riz', 'risotto', 'arborio', 'basmati', 'jasmine', 'thai'], 'riz'],
  // Produits laitiers (SAUF lait et beurre, trop generiques)
  [['creme liquide', 'creme fraiche'], 'creme liquide'],
  [['parmesan', 'parmigiano'], 'parmesan'],
  [['mozzarella', 'mozza', 'burrata'], 'mozzarella'],
  // Avant la règle « fromage » : « ravioles au fromage » sont des pâtes.
  [['raviole', 'ravioles'], 'pate'],  // avant fromage (contient "fromage")
  [['emmental', 'comte', 'gruyere'], 'fromage rape'],
  [['cheddar', 'gorgonzola', 'feta', 'fromage'], 'fromage'],
  [['yaourt', 'yaourt grec', 'skyr', 'fromage blanc', 'petit suisse'], 'yaourt'],
  // Oeufs
  [['oeuf', 'oeufs'], 'oeuf'],
  // Legumes
  [['oignon', 'oignons', 'echalote', 'cebette'], 'oignon'],
  [['carotte'], 'carotte'],
  [['pomme de terre', 'pommes de terre', 'patate'], 'pomme de terre'],
  [['tomate', 'tomates', 'tomate cerise', 'tomates cerises'], 'tomate'],
  [['salade', 'laitue', 'mache', 'roquette', 'mesclun'], 'salade'],
  [[' ail '], 'ail'],  // avec espaces pour eviter "volaille"
  // Fruits
  [['avocat'], 'avocat'],
  [['banane'], 'banane'],
  [['pomme'], 'pomme'],
  // Viandes
  [['filet de poulet', 'blanc de poulet', 'poulet', 'cuisse de poulet'], 'poulet'],
  [['boeuf', 'entrecote', 'faux-filet', 'rumsteck'], 'boeuf'],
  [['hache'], 'viande hachee'],
  [['jambon blanc', 'jambon fume', 'jambon cru'], 'jambon'],
  // Epicerie salee
  [['farine'], 'farine'],
  [['sucre'], 'sucre'],
  [['sel'], 'sel'],
  [['poivre noir', 'poivre blanc', 'poivre'], 'poivre'],
  [["huile d'olive"], "huile d'olive"],
  [['huile'], 'huile'],
  [['vinaigre'], 'vinaigre'],
  [['moutarde'], 'moutarde'],
  [['bouillon'], 'bouillon'],
  [['sauce soja', 'soja'], 'sauce soja'],
  [['ketchup', 'mayonnaise'], 'condiment'],
  // Epicerie sucree (AVANT lait/beurre)
  [['biscuit', 'cookie', 'granola', 'petit beurre'], 'biscuit'],
  [['cereale', 'cereales', 'tresor', 'kellogg', 'chocapic'], 'cereale'],
  [['cafe', 'capsule', 'dolce gusto', 'nescafe', 'nespresso'], 'cafe'],
  [['pain de mie', 'pain', 'baguette', 'campagnard', 'schar'], 'pain'],
  [['chips', 'cacahuete', 'cacahuetes', 'aperitif', 'twinuts'], 'aperitif'],
  [['houmous', 'humous'], 'houmous'],
  // Frais
  [['muffin', 'muffins', 'pate feuillettee', 'pate a pizza', 'pate'], 'pate'],
  // Boissons
  [[' biere ', ' ipa ', ' tourtel '], 'biere'],
  [['vin blanc', 'vin rouge', 'rose', 'vin'], 'vin'],
  [['jus'], 'jus'],
  // Lait, beurre (EN DERNIER car trop generiques)
  [['beurre'], 'beurre'],
  [['lait'], 'lait'],
  // Hygiene
  [['gel douche', 'shampooing', 'shampoing', 'savon'], 'gel douche'],
  [['dentifrice'], 'dentifrice'],
  [['deodorant'], 'deodorant'],
  [['brosse a dent'], 'brosse a dents'],
  [[' brosse '], 'brosse a dents'],
  // Papier
  [['papier toilette', 'pq'], 'papier toilette'],
  [['mouchoir', 'mouchoirs'], 'mouchoirs'],
  [['essuie-tout', 'essuie tout', 'essuie main'], 'essuie-tout'],
  // Droguerie
  [['lingette', 'lingettes desinfectantes'], 'lingettes'],
  [['briquet', 'briquets', 'bic'], 'briquet'],
  [['recharge gaz', 'gaz'], 'recharge gaz'],
  [['sac', 'sacs reutilisables', 'sacs consignes'], 'sac'],
];

const STOPWORDS = new Set([
  'avec', 'bio', 'blanc', 'carrefour', 'cl', 'classic', "classic'",
  'confit', 'confits', 'eco', 'economique', 'epais', 'epaise', 'essential',
  'extra', 'familial', 'fines', 'fondant', 'format', 'frais', 'fume',
  'fumee', 'fumees', 'fumes', 'g', 'hac', 'hb', 'jaune', 'kg', 'l',
  'legere', 'lot', 'maxi', 'ml', 'nature', 'noir', 'pack', 'planet', 'pur',
  'rape', 'rouge', 'sans', 'sensation', 'simpl', 'soft', 'tranche',
  'tranches', 'x'
]);

// Le portage normalise les accents avant comparaison, ce que la source Python
// ne fait pas (elle se contente de `lower().strip()`). C'est une amélioration
// délibérée : le Python rate ses propres règles dès qu'un nom porte un accent
// (« Céréales Trésor » ne matche pas `cereale` et retombe sur `lait`, « Féta
// cubes » ne matche pas `feta` et retombe sur `féta`). On assume cet écart.
// Plage Unicode « Combining Diacritical Marks » écrite en points de code
// (\u0300-\u036F) plutôt qu'en caractères littéraux invisibles : ces
// derniers se relisent comme un intervalle vide dans un éditeur ou un outil
// de reformatage, qui peut les altérer sans que rien ne se voie à l'écran.
const sansAccents = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '').trim();

const echappe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Extrait le type sémantique d'un produit depuis son nom.
 *
 * Un mot-clé encadré d'espaces dans la table (ex. `' biere '`, `' ail '`,
 * `' brosse '`) est une convention signifiant « chercher ce mot entier » :
 * les espaces marqueurs sont retirés avant la recherche, qui utilise alors
 * un motif de mot entier — pas un motif exigeant deux espaces consécutifs.
 * Les mots-clés de trois caractères ou moins (une fois les espaces marqueurs
 * retirés) sont traités de la même façon, ce qui évite qu'« ail » matche
 * « volaille ». Cette convention reproduit celle de product_typology.py et
 * n'est pas devinable en lisant seulement la table de règles.
 */
export function normalizeProductType(name: string | null | undefined): string | null {
  if (!name) return null;
  const nom = sansAccents(name);
  if (!nom) return null;

  for (const [motsCles, type] of TYPE_RULES) {
    for (const motCle of motsCles) {
      const motCleStrip = motCle.trim();
      const aMarqueurEspace = motCle !== motCleStrip;
      if (aMarqueurEspace || motCleStrip.length <= 3) {
        if (new RegExp(`(^|\\s)${echappe(motCleStrip)}($|\\s)`).test(nom)) return type;
      } else if (motCleStrip.includes(' ')) {
        if (new RegExp(`(^|\\s)${echappe(motCleStrip)}`).test(nom)) return type;
      } else if (nom.includes(motCleStrip)) {
        return type;
      }
    }
  }

  // Repli : premier mot significatif, hors mots vides et unités.
  const mots = nom
    .split(/\s+/)
    .filter((m) => m.length > 3 && !STOPWORDS.has(m) && !/^\d/.test(m));
  return mots[0] ?? null;
}
