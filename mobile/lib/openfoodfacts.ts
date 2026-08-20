/**
 * Client Open Food Facts pour le scan.
 *
 * Le mapping est porté de backend/app/services/enrich_ean.py : détection des
 * liquides et affectation de la quantité en grammes ou en millilitres.
 */
import { normalizeProductType } from './typology.ts';

export type FicheProduit = {
  ean13: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  grammageG: number | null;
  volumeMl: number | null;
  productType: string | null;
};

type OffData = {
  product_name?: string;
  brands?: string;
  image_url?: string;
  product_quantity?: number | string;
  categories_tags?: string[];
};

const MOTS_LIQUIDES = [
  'lait', 'huile', 'creme', 'jus', 'soda', 'biere', 'vin', 'sauce', 'sirop',
  'boisson', 'limonade', 'yaourt', 'eau', 'nectar', 'smoothie', 'tonic',
];

const CATEGORIES_LIQUIDES = ['beverages', 'drinks', 'waters', 'juices', 'milks'];

const sansAccents = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Un produit est liquide si son nom ou sa catégorie Open Food Facts le dit. */
export function estLiquide(nom: string, categories: string[] = []): boolean {
  const n = sansAccents(nom);
  if (MOTS_LIQUIDES.some((m) => new RegExp(`(^|\\s)${m}`).test(n))) return true;
  return categories.some((c) => CATEGORIES_LIQUIDES.some((l) => c.includes(l)));
}

/**
 * Convertit une réponse Open Food Facts en fiche exploitable.
 *
 * @returns null si la fiche n'a pas de nom — un produit sans libellé serait
 *   inutilisable dans le catalogue, mieux vaut basculer sur la saisie manuelle.
 */
export function mapOffProduct(ean: string, data: OffData): FicheProduit | null {
  const name = (data.product_name ?? '').trim();
  if (!name) return null;

  const quantite = Number(data.product_quantity);
  const valide = Number.isFinite(quantite) && quantite > 0;
  const liquide = estLiquide(name, data.categories_tags ?? []);

  return {
    ean13: ean,
    name,
    // Open Food Facts liste parfois plusieurs marques séparées par des virgules.
    brand: (data.brands ?? '').split(',')[0].trim() || null,
    imageUrl: data.image_url || null,
    grammageG: valide && !liquide ? Math.round(quantite) : null,
    volumeMl: valide && liquide ? Math.round(quantite) : null,
    productType: normalizeProductType(name),
  };
}

const URL_OFF = 'https://world.openfoodfacts.org/api/v2/product';
const CHAMPS = 'product_name,brands,image_url,product_quantity,categories_tags';

/**
 * Interroge Open Food Facts pour un code-barres.
 *
 * @returns null si le produit est inconnu ou la réponse illisible. L'appelant
 *   bascule alors sur la saisie manuelle.
 */
export async function lookupEan(ean: string): Promise<FicheProduit | null> {
  try {
    const reponse = await fetch(`${URL_OFF}/${ean}.json?fields=${CHAMPS}`, {
      headers: { 'User-Agent': 'courses-app/1.0 (usage familial)' },
    });
    if (!reponse.ok) return null;
    const json = await reponse.json();
    if (json.status !== 1 || !json.product) return null;
    return mapOffProduct(ean, json.product);
  } catch {
    return null;
  }
}
