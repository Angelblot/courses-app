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

/** Déduit le rayon d'un produit depuis ses catégories Open Food Facts. */
export function rayonDepuisCategories(tags: string[] | null | undefined): CleRayon {
  if (!tags?.length) return 'autre';
  for (const [rayon, fragments] of PRIORITE) {
    if (tags.some((t) => fragments.some((f) => t.includes(f)))) return rayon;
  }
  // Des étiquettes existent mais aucune ne correspond. Open Food Facts ne
  // référence que l'alimentaire : c'est donc de l'épicerie, pas « autre ».
  return 'epicerie';
}

/** Libellé affichable d'une clé de rayon. Toute clé inconnue rend « Autres ». */
export function libelleRayon(cle: string | null | undefined): string {
  return RAYONS.find((r) => r.cle === cle)?.label ?? 'Autres';
}
