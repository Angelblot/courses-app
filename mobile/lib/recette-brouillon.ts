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
  /** Repris de la page importée. Absent d'une saisie manuelle. */
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  kcal_per_serving?: number | null;
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

/** Rayons où l'on peut trouver un ingrédient de recette. */
const RAYONS_ALIMENTAIRES: ReadonlySet<string> = new Set([
  'pls', 'epicerie', 'fruits_legumes', 'charcuterie', 'boissons', 'surgeles',
]);

/**
 * Forme comparable d'un nom : sans casse, sans accent, sans ponctuation, et
 * au singulier — « Oignon jaune » doit retrouver « Oignons jaunes vrac ».
 */
function nettoyer(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((m) => (m.length > 3 && m.endsWith('s') ? m.slice(0, -1) : m))
    .join(' ');
}

/**
 * Cherche dans le catalogue le produit qui correspond à un ingrédient.
 *
 * La règle est volontairement stricte : le nom de l'ingrédient doit se
 * retrouver tel quel dans celui du produit.
 *
 * La typologie seule ne suffit pas — éprouvé le 24/08 sur 74 ingrédients
 * réels : « fromage » couvre le gorgonzola comme la feta, et la feta se
 * rattachait au gorgonzola. Un rattachement faux est pire qu'absent :
 * l'extension achèterait le mauvais produit sans rien signaler, là où un
 * ingrédient laissé libre se voit à l'écran et se cherche par son nom.
 */
export function produitPropose<
  T extends { name: string; category: string | null },
>(nom: string, produits: T[]): T | null {
  const complet = nettoyer(nom);
  // Trop court pour discriminer : « ail » se retrouve dans « Boursin Ail &
  // Fines Herbes », qui n'est pas de l'ail.
  if (complet.length < 4) return null;

  // Un ingrédient de recette ne se trouve pas en parfumerie : sans ce
  // garde-fou, « Miel » se rattachait au « Savon Liquide Mains Lait Et Miel ».
  const mangeables = produits.filter((p) => RAYONS_ALIMENTAIRES.has(rayonDepuisLibelle(p.category)));

  const essais = [complet];
  const avantParenthese = nom.split('(')[0].trim();
  if (avantParenthese && avantParenthese !== nom.trim()) essais.push(nettoyer(avantParenthese));

  for (const essai of essais) {
    if (essai.length < 4) continue;
    const trouves = mangeables.filter((p) => nettoyer(p.name).includes(essai));
    // Une seule correspondance, ou rien : « pâtes » désigne aussi bien les
    // spaghettis que les gnocchis, et trancher au hasard mettrait le mauvais
    // produit dans le panier.
    if (trouves.length === 1) return trouves[0];
  }
  return null;
}

/**
 * Propose un rayon pour un ingrédient, par typologie.
 *
 * Volontairement plus large que `produitPropose`, et indépendante d'elle : un
 * rayon faux range mal un article dans la liste, un produit faux le met dans
 * le panier. Le premier peut se permettre d'être approximatif — tout fromage
 * est en crémerie, même si ce n'est pas le bon fromage.
 *
 * Sans correspondance, « autre » — jamais un champ vide, qui obligerait à
 * choisir avant de pouvoir avancer.
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
