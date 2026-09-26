import { create } from 'zustand';
import { useRecipesStore } from './recipesStore.js';
import { useProductsStore } from './productsStore.js';
import { persist } from 'zustand/middleware';
import { WizardAPI, ResolverAPI } from '../api.js';
import { useUIStore } from './uiStore.js';
import { convertToProductQty, isConvertible, formatIngredientQty, normalizeUnit } from '../lib/unitConverter.js';

export const WIZARD_STEPS = [
  { key: 'recipes', label: 'Mes repas' },
  { key: 'checklist', label: 'Ma liste' },
  { key: 'recap', label: 'Mes paniers' },
];
export const canonicalStep = (step) => ({ ingredients: 'checklist', generate: 'recap' }[step] || step);

const INITIAL = {
  selectedRecipes: {},
  ingredientChoices: {},
  quotidien: {},
  quotidienQty: {},
  extras: [],
  selectedDrives: [],
  lastStep: 'recipes',
  draftStarted: false,
  launchError: null,
  sessionId: null,
  generating: false,
};

export const useWizardStore = create(persist((set, get) => ({
  ...INITIAL,

  setLastStep: (lastStep) => set({ lastStep, draftStarted: true }),
  lastSessionId: null,
  favoriteRecipes: [],
  defaultServings: 4,
  setDefaultServings: (n) => set({ defaultServings: Math.max(1, Math.min(20, Number(n) || 4)) }),
  toggleFavoriteRecipe: (id) => set((s) => ({ favoriteRecipes: s.favoriteRecipes.includes(id) ? s.favoriteRecipes.filter((v) => v !== id) : [...s.favoriteRecipes, id] })),
  setIngredientChoice: (key, patch) => set((s) => ({ ingredientChoices: { ...s.ingredientChoices, [key]: { ...s.ingredientChoices[key], ...patch } } })),
  updateExtra: (id, patch) => set((s) => ({ extras: s.extras.map((e) => e.id === id ? {...e, ...patch} : e) })),

  reset: () =>
    set({
      ...INITIAL,
      selectedRecipes: {},
      quotidien: {},
      quotidienQty: {},
      extras: [],
    }),

  toggleRecipe: (recipe) => {
    const current = { ...get().selectedRecipes };
    if (current[recipe.id] != null) delete current[recipe.id];
    else current[recipe.id] = recipe.servings_default || 2;
    set({ selectedRecipes: current });
  },

  setServings: (recipeId, servings) => {
    const n = Math.max(1, parseInt(servings, 10) || 1);
    set((state) => ({
      selectedRecipes: { ...state.selectedRecipes, [recipeId]: n },
    }));
  },

  markProduct: (productId, status) => {
    const current = { ...get().quotidien };
    if (status == null || current[productId] === status) delete current[productId];
    else current[productId] = status;
    set({ quotidien: current });
  },

  setQuotidienQty: (productId, qty) => {
    const n = Math.max(0, +qty || 0);
    set((state) => ({ quotidienQty: { ...state.quotidienQty, [productId]: n } }));
  },

  addExtra: (extra) => {
    const entry = {
      id: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      quantity: 1,
      unit: 'unité',
      rayon: 'Divers',
      category: 'Divers',
      ...extra,
    };
    set((state) => ({ extras: [...state.extras, entry] }));
  },

  removeExtra: (id) =>
    set((state) => ({ extras: state.extras.filter((e) => e.id !== id) })),

  toggleDrive: (name) => {
    const current = get().selectedDrives;
    const next = current.includes(name)
      ? current.filter((d) => d !== name)
      : [...current, name];
    set({ selectedDrives: next });
  },

  setDrives: (drives) => set({ selectedDrives: drives }),

  launch: async () => {
    if (get().generating || get().selectedDrives.length === 0) return null;
    const { selectedRecipes, quotidien, quotidienQty, extras, selectedDrives, ingredientChoices } = get();
    const recipes = useRecipesStore.getState().items;
    const products = useProductsStore.getState().items;
    const ingredient_overrides = getRecipeIngredientMatches({recipes, products, selectedRecipes}).flatMap((group) => {
      const choice = resolveIngredientChoice(group, ingredientChoices, quotidien, products);
      if (!choice.owned && !choice.product) return [];
      return [{ ingredients: group.sources.map((source) => ({recipe_id: Number(source.recipeId), name: source.ingredientName, unit: source.originalUnit})),
        owned: choice.owned, product_id: choice.product?.id || null, quantity: choice.quantity }];
    });

    const payload = {
      ingredient_overrides,
      recipes: Object.entries(selectedRecipes).map(([recipe_id, servings]) => ({
        recipe_id,
        servings,
      })),
      quotidien: Object.entries(quotidien).map(([product_id, status]) => ({
        product_id: Number(product_id) || product_id,
        needed: status === 'needed',
        quantity: Math.max(1, quotidienQty[product_id] || 1),
      })),
      extras: extras.filter((e) => !e.owned).map(({ id, owned, ...rest }) => rest),
      drives: selectedDrives,
    };

    set({ generating: true, launchError: null });
    try {
      const session = await WizardAPI.createSession(payload);
      if (session?.id == null) throw new Error('Session indisponible');
      set({ sessionId: session.id });
      await WizardAPI.launchGeneration(session.id, { drives: selectedDrives });
      set({ lastSessionId: session.id });
      useUIStore.getState().notifySuccess('Demande envoyée. Consulte le suivi de tes paniers.');
      return session.id;
    } catch (err) {
      set({ launchError: 'La demande n’a pas pu être confirmée. Tes choix sont conservés. Vérifie le suivi avant de réessayer.' });
      return null;
    } finally {
      set({ generating: false });
    }
  },
}), {
  name: 'courses-draft',
  version: 1,
  partialize: ({ selectedRecipes, quotidien, quotidienQty, extras, selectedDrives, lastStep, draftStarted, lastSessionId, ingredientChoices, favoriteRecipes, defaultServings }) => ({
    selectedRecipes, quotidien, quotidienQty, extras, selectedDrives, lastStep, draftStarted, lastSessionId, ingredientChoices, favoriteRecipes, defaultServings,
  }),
}));

function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

/**
 * getRecipeUsage : pour un produit donné, calcule la quantité nécessaire
 * dans toutes les recettes sélectionnées. Utilise unitConverter pour
 * gérer les conversions g↔unité, ml↔unité, unités dénombrables.
 *
 * Matching : product_id direct -> product_type -> nom (fallback).
 * Le matching par product_type est traité comme un match direct
 * (lardons et allumettes fusionnent dans le même produit).
 *
 * @param {object} options
 * @param {number|string} options.productId
 * @param {string} options.productName
 * @param {string} options.productUnit
 * @param {object} options.product - Objet produit complet (avec grammage_g, volume_ml, product_type)
 * @param {object} options.selectedRecipes
 * @param {Array} options.recipes
 * @returns {{ totalQuantity: number, breakdown: Array, approximate: boolean, missingGrammage: boolean, hasSubstitutions: boolean, substitutionCount: number, substitutionIngredient: object|null, product: object|null }}
 */
export function getRecipeUsage({
  productId,
  productName,
  productUnit,
  product,
  selectedRecipes,
  recipes,
}) {
  const breakdown = [];
  let totalQuantity = 0;
  let anyApproximate = false;
  let missingGrammage = false;
  if (!recipes || !selectedRecipes) {
    return { totalQuantity, breakdown, approximate: false, missingGrammage: false, hasSubstitutions: false, substitutionCount: 0, substitutionIngredient: null, product: product || null };
  }

  const targetName = normalizeName(productName);
  const prod = product || { id: productId, name: productName, unit: productUnit };
  const targetType = prod.product_type || null;

  recipes.forEach((recipe) => {
    const servings = selectedRecipes[recipe.id];
    if (servings == null) return;
    (recipe.ingredients || []).forEach((ing) => {
      const matchById =
        productId != null &&
        ing.product_id != null &&
        String(ing.product_id) === String(productId);

      const matchByType =
        !matchById &&
        targetType != null &&
        ing.product_type != null &&
        ing.product_type === targetType;

      const ingName = normalizeName(ing.name);
      const matchByNameStrict =
        !matchById &&
        !matchByType &&
        targetName.length > 0 &&
        ingName.length > 0 &&
        (targetName === ingName ||
          targetName.includes(ingName) ||
          ingName.includes(targetName));
      const matchByName = matchByNameStrict && isConvertible(ing.unit, prod);

      if (!matchById && !matchByType && !matchByName) return;

      const baseQty = (ing.quantity_per_serving || 0) * servings;
      const converted = convertToProductQty(baseQty, ing.unit, prod);

      // Detect if conversion failed because product has no grammage/volume
      if (converted.qty === 0 && baseQty > 0) {
        const ingNorm = normalizeUnit(ing.unit);
        const prodUnitNorm = normalizeUnit(prod.unit || 'unité');
        // Ingredient is weight/volume but product is "unité" — needs grammage_g or volume_ml
        if (ingNorm === 'g' && prodUnitNorm === 'unité' && prod.grammage_g == null) {
          missingGrammage = true;
        }
        if (ingNorm === 'ml' && prodUnitNorm === 'unité' && prod.volume_ml == null) {
          missingGrammage = true;
        }
      }

      const qty = converted.qty;

      breakdown.push({
        recipeName: recipe.name,
        qty,
        unit: ing.unit || 'unité',
        ingredientQty: baseQty,
        ingredientUnit: ing.unit,
        approximate: converted.approximate,
      });
      totalQuantity += qty;
      if (converted.approximate) anyApproximate = true;
    });
  });

  return {
    totalQuantity,
    breakdown,
    approximate: anyApproximate,
    missingGrammage,
    hasSubstitutions: false,
    substitutionCount: 0,
    substitutionIngredient: null,
    product: prod,
  };
}

export function resolveIngredientChoice(group, choices = {}, quotidien = {}, products = []) {
  const saved = choices[group.key] || {};
  const product = products.find((p) => String(p.id) === String(saved.productId)) || group.matchingProducts[0];
  const owned = saved.owned ?? (product && quotidien[product.id] === 'owned') ?? false;
  const quantity = saved.quantity ?? (product ? Math.max(1, convertToProductQty(group.totalQty, group.unit, product).qty || 1) : group.totalQty);
  return {product, quantity, owned};
}

export function buildConsolidatedItems({recipes, selectedRecipes, quotidien, quotidienQty, extras, products, ingredientChoices = {}}) {
  const bucket = new Map();
  const push = (entry, source) => {
    const key = `${entry.productId || ''}__${entry.name.trim().toLowerCase()}__${entry.unit}`;
    if (bucket.has(key)) { const item = bucket.get(key); item.totalQuantity += entry.quantity; item.sources.push(source); }
    else bucket.set(key, {...entry, key, totalQuantity: entry.quantity, rayon: entry.rayon || entry.category || 'Divers', sources: [source]});
  };
  getRecipeIngredientMatches({recipes, selectedRecipes, products}).forEach((group) => {
    const {owned, product, quantity} = resolveIngredientChoice(group, ingredientChoices, quotidien, products);
    if (owned || group.totalQty <= 0) return;
    push({ name: product?.name || group.ingredientName, productId: product?.id, quantity, unit: product?.unit || group.unit,
      rayon: product?.rayon || group.categoryHint, category: product?.category },
      {type: 'recipe', label: [...new Set(group.sources.map((s) => s.recipeName))].join(', '), qty: quantity});
  });
  Object.entries(quotidien || {}).forEach(([id, status]) => {
    if (status !== 'needed') return;
    const p = products.find((p) => String(p.id) === String(id));
    if (!p) return;
    const quantity = quotidienQty[id] || p.default_quantity || 1;
    push({name:p.name, productId:p.id, quantity, unit:p.unit || 'unité', rayon:p.rayon, category:p.category}, {type:'quotidien',label:'En plus des repas',qty:quantity});
  });
  (extras || []).filter((e) => !e.owned).forEach((e) => push(e, {type:'extra',label:'Ajout manuel',qty:e.quantity,extraId:e.id}));
  return [...bucket.values()].sort((a,b) => a.rayon.localeCompare(b.rayon,'fr') || a.name.localeCompare(b.name,'fr'));
}

export function groupByRayon(items) {
  const map = new Map();
  items.forEach((item) => {
    if (!map.has(item.rayon)) map.set(item.rayon, []);
    map.get(item.rayon).push(item);
  });
  return Array.from(map.entries()).map(([rayon, entries]) => ({ rayon, entries }));
}

/**
 * getRecipeIngredientMatches : pour chaque ingrédient des recettes sélectionnées,
 * regroupe par `product_type` et renvoie la liste des produits du catalogue qui
 * matchent ce type. Permet à l'utilisateur de valider/changer le produit qui sera
 * mis au panier pour chaque ingrédient.
 *
 * @param {object} options
 * @param {object} options.selectedRecipes - Map {recipeId: servings}
 * @param {Array}  options.recipes - Recettes complètes (avec ingredients[])
 * @param {Array}  options.products - Catalogue produit complet
 * @returns {Array<{
 *   key: string,
 *   productType: string|null,
 *   ingredientName: string,
 *   totalQty: number,
 *   unit: string,
 *   sources: Array<{ recipeId, recipeName, qty, unit }>,
 *   matchingProducts: Array,
 *   categoryHint: string|null,
 * }>}
 */
export function getRecipeIngredientMatches({
  selectedRecipes,
  recipes,
  products,
}) {
  if (!recipes || !selectedRecipes || !products) return [];

  const groups = new Map();

  recipes.forEach((recipe) => {
    const servings = selectedRecipes[recipe.id];
    if (servings == null) return;

    (recipe.ingredients || []).forEach((ing) => {
      const productType = ing.product_type || null;
      const ingName = (ing.name || '').trim();
      // Group by product_type if available, fall back to lowercased name.
      const groupKey = `${productType || `name:${ingName.toLowerCase()}`}::${(ing.unit || 'unité').toLowerCase()}`;
      const qty = (ing.quantity_per_serving || 0) * servings;

      const existing = groups.get(groupKey);
      if (existing) {
        existing.totalQty += qty;
        if (ing.product_id && !existing.productIds.includes(ing.product_id)) existing.productIds.push(ing.product_id);
        existing.sources.push({
          ingredientName: ing.name, originalUnit: ing.unit,
          recipeId: recipe.id,
          recipeName: recipe.name,
          qty,
          unit: ing.unit || 'unité',
        });
      } else {
        groups.set(groupKey, {
          key: groupKey,
          productType,
          ingredientName: ingName,
          totalQty: qty,
          unit: ing.unit || 'unité',
          sources: [{
            ingredientName: ing.name, originalUnit: ing.unit,
          recipeId: recipe.id,
            recipeName: recipe.name,
            qty,
            unit: ing.unit || 'unité',
          }],
          productIds: [ing.product_id].filter(Boolean),
          categoryHint: ing.rayon || ing.category_hint || ing.category || null,
        });
      }
    });
  });

  // Resolve matching products for each group
  return Array.from(groups.values()).map((group) => {
    const matchingProducts = products.filter((p) => group.productIds.some((id) => String(id) === String(p.id)) || (group.productType && p.product_type === group.productType));
    return { ...group, matchingProducts };
  });
}
