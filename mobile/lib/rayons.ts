/**
 * Rayons du magasin, et déduction du rayon depuis les catégories Open Food Facts.
 *
 * Les 10 rayons reprennent la table `categories` de Supabase : mêmes clés, mêmes
 * libellés, même ordre d'affichage. La clé est ce qui est stocké dans
 * `products.category` ; le libellé est ce qui s'affiche.
 */

export type CleRayon =
  | 'fruits_legumes' | 'pls' | 'charcuterie' | 'boissons' | 'epicerie'
  | 'droguerie' | 'parfumerie' | 'maison' | 'surgeles' | 'autre';

/** Ordre repris de `categories.display_order` en base. */
export const RAYONS: ReadonlyArray<{ cle: CleRayon; label: string }> = [
  { cle: 'fruits_legumes', label: 'Fruits & légumes' },
  { cle: 'pls', label: 'Produits laitiers' },
  { cle: 'charcuterie', label: 'Charcuterie & traiteur' },
  { cle: 'boissons', label: 'Boissons' },
  { cle: 'epicerie', label: 'Épicerie' },
  { cle: 'droguerie', label: 'Droguerie' },
  { cle: 'parfumerie', label: 'Hygiène' },
  { cle: 'maison', label: 'Maison' },
  { cle: 'surgeles', label: 'Surgelés' },
  { cle: 'autre', label: 'Autres' },
];

/**
 * (rayon, fragments d'étiquette Open Food Facts).
 *
 * L'ordre est une PRIORITÉ DE RAYON, et non une spécificité d'étiquette. Une
 * pizza surgelée porte `en:frozen-foods` et `en:pizzas` : retenir l'étiquette la
 * plus précise l'enverrait en épicerie, alors qu'on ira la chercher au
 * congélateur. Le rayon décrit un emplacement physique dans le magasin.
 *
 * La comparaison est un `includes` sur l'étiquette entière, ce qui fait que
 * `en:mint-syrups` correspond à `syrups` et `en:cheeses-perishable` à `cheeses`.
 */
const PRIORITE: ReadonlyArray<readonly [CleRayon, readonly string[]]> = [
  // En tête : le congélateur l'emporte sur ce que contient le paquet.
  ['surgeles', ['frozen-foods', 'frozen-desserts', 'ice-cream']],
  ['boissons', ['beverages', 'waters', 'juices', 'syrups', 'sodas', 'beers', 'wines', 'alcoholic']],
  // `eggs` est ici et non dans `pls` : Carrefour range les œufs en
  // CHARCUT.TRAITEUR, et c'est là que l'utilisateur ira les chercher.
  ['charcuterie', ['charcuteries', 'hams', 'sausages', 'prepared-meats', 'delicatessen', 'eggs']],
  ['pls', ['dairies', 'cheeses', 'yogurts', 'milks', 'butters']],
  ['fruits_legumes', ['fresh-vegetables', 'fresh-fruits']],
];

/**
 * Étiquettes parapluies, écartées avant toute comparaison.
 *
 * `en:plant-based-foods-and-beverages` coiffe la quasi-totalité de
 * l'alimentaire végétal, et son suffixe « beverages » correspondait à la règle
 * des boissons : chapelure, croûtons, thym et pain s'y retrouvaient tous.
 * Constaté le 24/08 en créant des produits depuis Open Food Facts.
 *
 * Ces étiquettes ne disent rien d'un emplacement en magasin. Les écarter vaut
 * mieux que d'affiner la comparaison : le `includes` partiel est délibéré —
 * c'est lui qui fait correspondre `en:mint-syrups` à `syrups`.
 */
const PARAPLUIES: ReadonlySet<string> = new Set([
  'en:plant-based-foods-and-beverages',
  'en:plant-based-foods',
  'en:foods',
  'en:groceries',
  'en:fresh-foods',
]);

/** Déduit le rayon d'un produit depuis ses catégories Open Food Facts. */
export function rayonDepuisCategories(tags: string[] | null | undefined): CleRayon {
  if (!tags?.length) return 'autre';
  const utiles = tags.filter((t) => !PARAPLUIES.has(t));
  for (const [rayon, fragments] of PRIORITE) {
    if (utiles.some((t) => fragments.some((f) => t.includes(f)))) return rayon;
  }
  // Des étiquettes existent mais aucune ne correspond. Open Food Facts ne
  // référence que l'alimentaire : c'est donc de l'épicerie, pas « autre ».
  return 'epicerie';
}

/** Libellé affichable d'une clé de rayon. Toute clé inconnue rend « Autres ». */
export function libelleRayon(cle: string | null | undefined): string {
  return RAYONS.find((r) => r.cle === cle)?.label ?? 'Autres';
}

/**
 * Ramène un libellé de rayon en clair vers une clé canonique.
 *
 * `recipe_ingredients.rayon` porte un troisième vocabulaire, saisi à la main :
 * « Produits laitiers », « Fruits et légumes », « Boucherie ». Sans cette
 * traduction, le récapitulatif afficherait le même rayon deux fois sous deux
 * noms — une fois pour les ingrédients, une fois pour les produits.
 *
 * Accepte aussi une clé canonique telle quelle : le récapitulatif mélange des
 * lignes venant des ingrédients (libellés) et des produits (clés).
 */
const LIBELLES: ReadonlyArray<readonly [string, CleRayon]> = [
  ['produits laitiers', 'pls'],
  ['pls', 'pls'],
  // Carrefour n'a pas de rayon boucherie : la volaille est en P.L.S.
  ['boucherie', 'pls'],
  ['volaille', 'pls'],
  ['fruits et legumes', 'fruits_legumes'],
  ['fruits legumes', 'fruits_legumes'],
  ['charcuterie', 'charcuterie'],
  ['charcuterie et traiteur', 'charcuterie'],
  ['traiteur', 'charcuterie'],
  ['epicerie', 'epicerie'],
  ['boissons', 'boissons'],
  ['surgeles', 'surgeles'],
  ['droguerie', 'droguerie'],
  ['hygiene', 'parfumerie'],
  ['parfumerie', 'parfumerie'],
  ['maison', 'maison'],
];

export function rayonDepuisLibelle(libelle: string | null | undefined): CleRayon {
  if (!libelle) return 'autre';
  const n = libelle
    .toLowerCase()
    .normalize('NFD')
    // Points de code plutôt que caractères littéraux : ces marques sont
    // invisibles dans un éditeur et se perdent au copier-coller.
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/&/g, 'et')
    .replace(/[^a-z_ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!n) return 'autre';
  // Clé canonique passée telle quelle.
  const cle = RAYONS.find((r) => r.cle === n);
  if (cle) return cle.cle;
  const trouve = LIBELLES.find(([l]) => l === n);
  return trouve ? trouve[1] : 'autre';
}
