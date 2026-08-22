import { normalizeProductType } from './typology.ts';
import { rayonDepuisLibelle, type CleRayon } from './rayons.ts';

export type IngredientBrouillon = {
  name: string;
  quantity_per_serving: number;
  unit: string;
  rayon: CleRayon;
  product_id: string | null;
};

export type Brouillon = {
  name: string;
  servings_default: number;
  ingredients: IngredientBrouillon[];
};

/** Unités proposées, reprises du formulaire web. */
export const UNITES = [
  'unité', 'g', 'kg', 'ml', 'L',
  'pincée', 'cuillère à café', 'cuillère à soupe',
] as const;

/**
 * Valide un brouillon avant enregistrement.
 *
 * @returns un message en français, ou `null` si le brouillon est valide.
 */
export function valideBrouillon(b: Brouillon): string | null {
  if (!b.name?.trim()) return 'Donne un nom à ta recette.';
  if (!Number.isFinite(b.servings_default) || b.servings_default < 1) {
    return 'Le nombre de parts doit être au moins 1.';
  }
  if (!b.ingredients?.length) {
    // Sans ce garde-fou, la recette s'enregistre puis ne produit rien dans le
    // wizard, sans qu'aucun écran n'explique pourquoi.
    return 'Ajoute au moins un ingrédient.';
  }
  for (const [i, ing] of b.ingredients.entries()) {
    if (!ing.name?.trim()) return `L'ingrédient ${i + 1} n'a pas de nom.`;
    if (!Number.isFinite(ing.quantity_per_serving) || ing.quantity_per_serving < 0) {
      return `La quantité de l'ingrédient ${i + 1} est invalide.`;
    }
  }
  return null;
}

/**
 * Propose un rayon pour un ingrédient : on cherche un produit du catalogue de
 * même typologie et on reprend son rayon. Sans correspondance, « autre » —
 * jamais un champ vide, qui obligerait à choisir avant de pouvoir avancer.
 */
export function rayonPropose(
  nom: string,
  produits: Array<{ product_type: string | null; category: string | null }>,
): CleRayon {
  const type = normalizeProductType(nom);
  if (!type) return 'autre';
  const trouve = produits.find((p) => p.product_type === type);
  return trouve ? rayonDepuisLibelle(trouve.category) : 'autre';
}
