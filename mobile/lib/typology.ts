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
  [['raviole', 'ravioles'], 'pate'],
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

const sansAccents = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const echappe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Extrait le type sémantique d'un produit depuis son nom.
 *
 * Les mots-clés de trois caractères ou moins sont cherchés comme mots entiers,
 * ce qui évite qu'« ail » matche « volaille ».
 */
export function normalizeProductType(name: string | null | undefined): string | null {
  if (!name) return null;
  const nom = sansAccents(name);
  if (!nom) return null;

  for (const [motsCles, type] of TYPE_RULES) {
    for (const motCle of motsCles) {
      if (motCle.length <= 3) {
        if (new RegExp(`(^|\\s)${echappe(motCle)}($|\\s)`).test(nom)) return type;
      } else if (motCle.includes(' ')) {
        if (new RegExp(`(^|\\s)${echappe(motCle)}`).test(nom)) return type;
      } else if (nom.includes(motCle)) {
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
