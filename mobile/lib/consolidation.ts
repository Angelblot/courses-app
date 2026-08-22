/**
 * Consolidation de la liste de courses.
 *
 * Porté de frontend/src/stores/wizardStore.js. Ces fonctions ne touchent ni au
 * DOM ni au réseau : elles prennent les recettes retenues, les produits du
 * quotidien et les ajouts manuels, et rendent une liste dédoublonnée.
 */
import {
  convertToProductQty, isConvertible, normalizeUnit, quantiteNormalisee,
  type ProduitMesure, type UniteNormalisee,
} from './unites.ts';
import { normalizeProductType } from './typology.ts';
import { rayonDepuisLibelle, RAYONS, type CleRayon } from './rayons.ts';

export type Source = { type: 'recipe' | 'quotidien' | 'extra'; label: string; qty: number };

export type LigneConsolidee = {
  key: string;
  name: string;
  unit: string;
  rayon: CleRayon;
  totalQuantity: number;
  ean13: string | null;
  sources: Source[];
};

type IngredientEntree = {
  name: string;
  quantity_per_serving: number;
  unit?: string | null;
  rayon?: string | null;
  category?: string | null;
  product_id?: string | null;
  product_type?: string | null;
};

type RecetteEntree = { id: string; name: string; ingredients?: IngredientEntree[] };

type ProduitEntree = ProduitMesure & {
  id: string;
  name: string;
  category?: string | null;
  ean13?: string | null;
  product_type?: string | null;
  default_quantity?: number | null;
};

const normalizeName = (name: string | null | undefined) => (name || '').trim().toLowerCase();

/**
 * Type sémantique d'un ingrédient.
 *
 * Aucune table ne le stocke : le backend le calculait à la volée par
 * `normalize_product_type(self.name)`. On fait de même, avec la fonction
 * portée en TypeScript.
 */
const typeDe = (ing: IngredientEntree): string | null =>
  ing.product_type ?? normalizeProductType(ing.name);

/**
 * Quantité qu'un produit doit couvrir dans les recettes retenues.
 *
 * Le rapprochement se fait par identifiant, puis par type sémantique, puis par
 * nom. Le type est traité comme une correspondance directe : lardons et
 * allumettes se rejoignent sur le même produit.
 */
export function getRecipeUsage({
  productId,
  productName,
  productUnit,
  product,
  selectedRecipes,
  recipes,
}: {
  productId?: string | null;
  productName: string;
  productUnit?: string | null;
  product?: ProduitEntree | null;
  selectedRecipes: Record<string, number>;
  recipes: RecetteEntree[];
}) {
  const breakdown: Array<{
    recipeName: string; qty: number; unit: string;
    ingredientQty: number; ingredientUnit: string; approximate: boolean;
  }> = [];
  let totalQuantity = 0;
  let anyApproximate = false;
  let missingGrammage = false;

  const prod = product ?? ({ id: productId ?? '', name: productName, unit: productUnit } as ProduitEntree);
  if (!recipes || !selectedRecipes) {
    return { totalQuantity, breakdown, approximate: false, missingGrammage, product: prod };
  }

  const targetName = normalizeName(productName);
  const targetType = prod.product_type ?? null;

  // On accumule dans l'unité de l'ingrédient, puis on convertit une seule
  // fois. Convertir chaque recette puis additionner surestime : 400 g et
  // 100 g d'un produit vendu par 500 g donneraient deux paquets alors qu'un
  // suffit — et cinq recettes partageant un ingrédient en donneraient cinq.
  const sommes = new Map<UniteNormalisee, number>();
  let sommeNonConvertible = 0;

  recipes.forEach((recipe) => {
    const servings = selectedRecipes[recipe.id];
    if (servings == null) return;
    (recipe.ingredients ?? []).forEach((ing) => {
      const typeIngredient = typeDe(ing);

      const matchById =
        productId != null && ing.product_id != null && String(ing.product_id) === String(productId);

      const matchByType =
        !matchById && targetType != null && typeIngredient != null && typeIngredient === targetType;

      const ingName = normalizeName(ing.name);
      const matchByNameStrict =
        !matchById && !matchByType && targetName.length > 0 && ingName.length > 0
        && (targetName === ingName || targetName.includes(ingName) || ingName.includes(targetName));
      const matchByName = matchByNameStrict && isConvertible(ing.unit ?? 'unité', prod);

      if (!matchById && !matchByType && !matchByName) return;

      const baseQty = (ing.quantity_per_serving || 0) * servings;
      const converti = convertToProductQty(baseQty, ing.unit ?? 'unité', prod);

      // Conversion impossible faute de conditionnement connu : l'écran doit le
      // dire, sinon une quantité incalculable se lit comme une quantité juste.
      if (converti.qty === 0 && baseQty > 0) {
        const ingNorm = normalizeUnit(ing.unit ?? 'unité');
        const prodNorm = normalizeUnit(prod.unit ?? 'unité');
        if (ingNorm === 'g' && prodNorm === 'unité' && prod.grammage_g == null) missingGrammage = true;
        if (ingNorm === 'ml' && prodNorm === 'unité' && prod.volume_ml == null) missingGrammage = true;
      }

      const normalisee = quantiteNormalisee(baseQty, ing.unit ?? 'unité');
      if (normalisee) {
        sommes.set(normalisee.famille, (sommes.get(normalisee.famille) ?? 0) + normalisee.valeur);
      } else {
        sommeNonConvertible += baseQty;
      }

      // Le détail montre ce que chaque recette demande, dans son unité
      // d'origine : c'est cela qui est lisible, pas un nombre d'articles
      // partiel qui ne s'additionne pas linéairement.
      breakdown.push({
        recipeName: recipe.name,
        qty: converti.qty,
        unit: ing.unit ?? 'unité',
        ingredientQty: baseQty,
        ingredientUnit: ing.unit ?? 'unité',
        approximate: converti.approximate,
      });
      if (converti.approximate) anyApproximate = true;
    });
  });

  // Conversion unique, sur les totaux.
  const UNITE_DE: Record<UniteNormalisee, string> = { g: 'g', ml: 'ml', 'unité': 'unité' };
  for (const [famille, valeur] of sommes) {
    const r = convertToProductQty(valeur, UNITE_DE[famille], prod);
    totalQuantity += r.qty;
    if (r.approximate) anyApproximate = true;
  }
  if (sommeNonConvertible > 0) totalQuantity += Math.ceil(sommeNonConvertible);

  return { totalQuantity, breakdown, approximate: anyApproximate, missingGrammage, product: prod };
}

/** Fusionne recettes, quotidien et ajouts manuels en une liste dédoublonnée. */
export function buildConsolidatedItems({
  recipes,
  selectedRecipes,
  quotidien,
  quotidienQty,
  extras,
  products,
}: {
  recipes: RecetteEntree[];
  selectedRecipes: Record<string, number>;
  quotidien: Record<string, 'needed' | 'have'>;
  quotidienQty: Record<string, number>;
  extras: Array<{ id: string; name: string; quantity: number; unit?: string | null; rayon?: string | null; ean13?: string | null }>;
  products: ProduitEntree[];
}): LigneConsolidee[] {
  const bucket = new Map<string, LigneConsolidee>();
  const keyOf = (name: string, unit: string) =>
    `${name.trim().toLowerCase()}__${(unit || '').toLowerCase()}`;

  const push = (
    entry: { name: string; quantity: number; unit?: string | null; rayon?: string | null; category?: string | null; ean13?: string | null },
    source: Source,
  ) => {
    const k = keyOf(entry.name, entry.unit ?? 'unité');
    const existant = bucket.get(k);
    if (existant) {
      existant.totalQuantity += entry.quantity;
      existant.sources.push(source);
      // Un code-barres connu d'un côté profite à la ligne entière.
      if (!existant.ean13 && entry.ean13) existant.ean13 = entry.ean13;
    } else {
      bucket.set(k, {
        key: k,
        name: entry.name,
        unit: entry.unit ?? 'unité',
        rayon: rayonDepuisLibelle(entry.rayon ?? entry.category),
        totalQuantity: entry.quantity,
        ean13: entry.ean13 ?? null,
        sources: [source],
      });
    }
  };

  // Un type déjà couvert par un produit du quotidien ne doit pas réapparaître
  // sous son nom d'ingrédient : sinon le récapitulatif porte à la fois
  // « Lardons 200g » et « Allumettes CARREFOUR ».
  const typesCouverts = new Set(
    Object.entries(quotidien ?? {})
      .filter(([, statut]) => statut === 'needed')
      .map(([pid]) => (products ?? []).find((pr) => String(pr.id) === String(pid)))
      .filter((p): p is ProduitEntree => Boolean(p?.product_type))
      .map((p) => p.product_type as string),
  );

  (recipes ?? []).forEach((recipe) => {
    const servings = selectedRecipes[recipe.id];
    if (servings == null) return;
    (recipe.ingredients ?? []).forEach((ing) => {
      const type = typeDe(ing);
      if (type && typesCouverts.has(type)) return;
      const qty = (ing.quantity_per_serving || 0) * servings;
      push(
        { name: ing.name, quantity: qty, unit: ing.unit, rayon: ing.rayon, category: ing.category },
        { type: 'recipe', label: recipe.name, qty },
      );
    });
  });

  Object.entries(quotidien ?? {}).forEach(([productId, statut]) => {
    if (statut !== 'needed') return;
    const p = (products ?? []).find((pr) => String(pr.id) === String(productId));
    if (!p) return;
    const qty = quotidienQty?.[productId] ?? p.default_quantity ?? 1;
    push(
      {
        name: p.name,
        quantity: qty,
        unit: p.unit ?? 'unité',
        category: p.category,
        ean13: p.ean13,
      },
      { type: 'quotidien', label: 'Quotidien', qty },
    );
  });

  (extras ?? []).forEach((e) => {
    push(e, { type: 'extra', label: 'Ajout manuel', qty: e.quantity });
  });

  // Tri par nom seulement : c'est `groupByRayon` qui impose l'ordre du magasin.
  return Array.from(bucket.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Groupe les lignes par rayon, dans l'ordre du magasin.
 *
 * L'ordre suit `display_order` et non l'alphabet : la version web plaçait
 * « Épicerie » avant « Fruits & légumes », ce qui fait traverser le magasin
 * deux fois.
 */
export function groupByRayon(
  items: LigneConsolidee[],
): Array<{ rayon: CleRayon; entries: LigneConsolidee[] }> {
  const map = new Map<CleRayon, LigneConsolidee[]>();
  items.forEach((item) => {
    if (!map.has(item.rayon)) map.set(item.rayon, []);
    map.get(item.rayon)!.push(item);
  });
  return RAYONS.filter((r) => map.has(r.cle)).map((r) => ({
    rayon: r.cle,
    entries: map.get(r.cle)!,
  }));
}

export type GroupeIngredient = {
  key: string;
  productType: string | null;
  ingredientName: string;
  totalQty: number;
  unit: string;
  sources: Array<{ recipeId: string; recipeName: string; qty: number; unit: string }>;
  matchingProducts: ProduitEntree[];
};

/**
 * Regroupe les ingrédients des recettes retenues par type sémantique, et
 * propose pour chacun les produits du catalogue qui portent ce type.
 */
export function getRecipeIngredientMatches({
  selectedRecipes,
  recipes,
  products,
}: {
  selectedRecipes: Record<string, number>;
  recipes: RecetteEntree[];
  products: ProduitEntree[];
}): GroupeIngredient[] {
  if (!recipes || !selectedRecipes || !products) return [];

  const groupes = new Map<string, GroupeIngredient>();

  recipes.forEach((recipe) => {
    const servings = selectedRecipes[recipe.id];
    if (servings == null) return;

    (recipe.ingredients ?? []).forEach((ing) => {
      const productType = typeDe(ing);
      const ingName = (ing.name || '').trim();
      const cle = productType ?? `name:${ingName.toLowerCase()}`;
      const qty = (ing.quantity_per_serving || 0) * servings;
      const source = { recipeId: recipe.id, recipeName: recipe.name, qty, unit: ing.unit ?? 'unité' };

      const existant = groupes.get(cle);
      if (existant) {
        existant.totalQty += qty;
        existant.sources.push(source);
      } else {
        groupes.set(cle, {
          key: cle,
          productType,
          ingredientName: ingName,
          totalQty: qty,
          unit: ing.unit ?? 'unité',
          sources: [source],
          matchingProducts: [],
        });
      }
    });
  });

  return Array.from(groupes.values()).map((groupe) => ({
    ...groupe,
    matchingProducts: groupe.productType
      ? products.filter((p) => p.product_type === groupe.productType)
      : [],
  }));
}

export type ItemPanier = {
  name: string;
  quantity: number;
  unit: string;
  ean13: string | null;
  category: CleRayon;
};

/**
 * Met la liste consolidée à la forme attendue dans `cart_jobs.items`.
 *
 * Fonction pure, volontairement ici et non dans `cart-jobs.ts` : ce dernier
 * importe le client Supabase, que Node ne sait pas charger hors de Metro, et
 * ne peut donc pas être couvert par `node --test`.
 *
 * `ean13` est conservé même absent : c'est lui qui rendra l'ajout certain chez
 * Carrefour au lot 5, dont les fiches exposent le code-barres dans leur
 * adresse. Sans lui, l'extension retombe sur la recherche par nom et son
 * risque d'ambiguïté.
 */
export function construireItems(lignes: LigneConsolidee[]): ItemPanier[] {
  return lignes.map((l) => ({
    name: l.name,
    quantity: l.totalQuantity,
    unit: l.unit,
    ean13: l.ean13 ?? null,
    category: l.rayon,
  }));
}
