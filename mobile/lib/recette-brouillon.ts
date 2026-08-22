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
  /** Adresse de la photo déposée, ou `null` : la recette prend alors un aplat. */
  image_url?: string | null;
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
 * Cherche dans le catalogue un produit de même typologie qu'un ingrédient.
 *
 * C'est ce qui évite de recréer « Lardons fumés » quand le produit existe
 * déjà : l'import s'y rattache, et la recette hérite de sa vignette et de son
 * rayon.
 */
export function produitPropose<T extends { product_type: string | null }>(
  nom: string,
  produits: T[],
): T | null {
  const type = normalizeProductType(nom);
  if (!type) return null;
  return produits.find((p) => p.product_type === type) ?? null;
}

/**
 * Propose un rayon pour un ingrédient : on reprend celui du produit trouvé.
 * Sans correspondance, « autre » — jamais un champ vide, qui obligerait à
 * choisir avant de pouvoir avancer.
 */
export function rayonPropose(
  nom: string,
  produits: Array<{ product_type: string | null; category: string | null }>,
): CleRayon {
  const trouve = produitPropose(nom, produits);
  return trouve ? rayonDepuisLibelle(trouve.category) : 'autre';
}
