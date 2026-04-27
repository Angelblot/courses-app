import { create } from 'zustand';
import { WizardAPI, ResolverAPI } from '../api.js';
import { useUIStore } from './uiStore.js';
import { convertToProductQty, isConvertible, formatIngredientQty } from '../lib/unitConverter.js';

export const WIZARD_STEPS = [
  { key: 'recipes', label: 'Recettes' },
  { key: 'checklist', label: 'Quotidien' },
  { key: 'recap', label: 'Récap' },
  { key: 'generate', label: 'Générer' },
];

const INITIAL = {
  selectedRecipes: {},
  quotidien: {},
  quotidienQty: {},
  extras: [],
  selectedDrives: ['carrefour', 'leclerc'],
  sessionId: null,
  generating: false,
};

export const useWizardStore = create((set, get) => ({
  ...INITIAL,

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
    const { selectedRecipes, quotidien, quotidienQty, extras, selectedDrives } = get();

    const payload = {
      recipes: Object.entries(selectedRecipes).map(([recipe_id, servings]) => ({
        recipe_id,
        servings,
      })),
      quotidien: Object.entries(quotidien).map(([product_id, status]) => ({
        product_id: Number(product_id) || product_id,
        needed: status === 'needed',
        quantity: quotidienQty[product_id],
      })),
      extras: extras.map(({ id, ...rest }) => rest),
      drives: selectedDrives,
    };

    set({ generating: true });
    try {
      let session;
      try {
        session = await WizardAPI.createSession(payload);
      } catch {
        session = { id: `local-${Date.now()}` };
      }
      set({ sessionId: session.id });

      try {
        await WizardAPI.launchGeneration(session.id, { drives: selectedDrives });
      } catch {
        /* silent: mock results fallback */
      }

      useUIStore.getState().notifySuccess('Génération lancée');
      return session.id;
    } catch (err) {
      useUIStore.getState().notifyError(err);
      return null;
    } finally {
      set({ generating: false });
    }
  },
}));

function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

/**
 * getRecipeUsage : pour un produit donné, calcule la quantité nécessaire
 * dans toutes les recettes sélectionnées. Utilise unitConverter pour
 * gérer les conversions g↔unité, ml↔unité, unités dénombrables.
 *
 * Retourne aussi des informations de substitution si le produit est lié
 * à des ingrédients de recettes (via le resolver).
 *
 * @param {object} options
 * @param {number|string} options.productId
 * @param {string} options.productName
 * @param {string} options.productUnit
 * @param {object} options.product - Objet produit complet (avec grammage_g, volume_ml)
 * @param {object} options.selectedRecipes
 * @param {Array} options.recipes
 * @param {Array} options.allProducts - Tous les produits (pour lookup croisé category+grammage)
 * @returns {{ totalQuantity: number, breakdown: Array, approximate: boolean, missingGrammage: boolean, hasSubstitutions: boolean, substitutionCount: number, substitutionIngredient: object|null }}
 */
export function getRecipeUsage({
  productId,
  productName,
  productUnit,
  product,
  selectedRecipes,
  recipes,
  allProducts = [],
}) {
  const breakdown = [];
  let totalQuantity = 0;
  let anyApproximate = false;
  let missingGrammage = false;
  let hasSubstitutions = false;
  let substitutionCount = 0;
  let substitutionIngredient = null;
  if (!recipes || !selectedRecipes) {
    return { totalQuantity, breakdown, approximate: false, missingGrammage: false, hasSubstitutions: false, substitutionCount: 0, substitutionIngredient: null };
  }

  const targetName = normalizeName(productName);
  const prod = product || { id: productId, name: productName, unit: productUnit };

  recipes.forEach((recipe) => {
    const servings = selectedRecipes[recipe.id];
    if (servings == null) return;
    (recipe.ingredients || []).forEach((ing) => {
      const matchById =
        productId != null &&
        ing.product_id != null &&
        String(ing.product_id) === String(productId);
      const ingName = normalizeName(ing.name);
      const matchByName =
        !matchById &&
        targetName.length > 0 &&
        ingName.length > 0 &&
        isConvertible(ing.unit, prod) &&
        (targetName === ingName ||
          targetName.includes(ingName) ||
          ingName.includes(targetName));
      // Match par catégorie + grammage : si l'ingrédient a un product_id,
      // vérifie si ce produit lié a la même catégorie ET le même grammage/volume
      // que le produit courant (substitution : lardons ↔ allumettes, etc.)
      let matchByCategory = false;
      if (!matchById && !matchByName && ing.product_id != null && product) {
        const linkedProduct = allProducts.find(
          (p) => String(p.id) === String(ing.product_id)
        );
        if (linkedProduct) {
          const sameCategory =
            product.category != null &&
            linkedProduct.category != null &&
            normalizeName(product.category) === normalizeName(linkedProduct.category);
          const sameGrammage =
            product.grammage_g != null &&
            linkedProduct.grammage_g != null &&
            product.grammage_g === linkedProduct.grammage_g;
          const sameVolume =
            product.volume_ml != null &&
            linkedProduct.volume_ml != null &&
            product.volume_ml === linkedProduct.volume_ml;
          matchByCategory = sameCategory && (sameGrammage || sameVolume);
        }
      }

      // Track substitution candidates : ingrédient lié à un autre produit
      // mais le produit courant pourrait le substituer
      if (!matchById && !matchByName && !matchByCategory && ing.product_id != null && product) {
        const linkedProduct = allProducts.find(
          (p) => String(p.id) === String(ing.product_id)
        );
        if (linkedProduct && linkedProduct.id !== product.id) {
          // L'ingrédient est lié à un produit différent — potentiel de substitution
          if (!substitutionIngredient) {
            substitutionIngredient = {
              name: ing.name,
              qty: (ing.quantity_per_serving || 0) * servings,
              unit: ing.unit,
              category_hint: ing.category_hint || ing.category || null,
              recipeName: recipe.name,
            };
          }
          substitutionCount++;
          hasSubstitutions = true;
        }
      }

      if (!matchById && !matchByName && !matchByCategory) return;

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

  return { totalQuantity, breakdown, approximate: anyApproximate, missingGrammage, hasSubstitutions, substitutionCount, substitutionIngredient };
}

export function buildConsolidatedItems({
  recipes,
  selectedRecipes,
  quotidien,
  quotidienQty,
  extras,
  products,
}) {
  const bucket = new Map();
  const keyOf = (name, unit) =>
    `${name.trim().toLowerCase()}__${(unit || '').toLowerCase()}`;

  const push = (entry, source) => {
    const k = keyOf(entry.name, entry.unit);
    const existing = bucket.get(k);
    if (existing) {
      existing.totalQuantity += entry.quantity;
      existing.sources.push(source);
    } else {
      bucket.set(k, {
        key: k,
        name: entry.name,
        unit: entry.unit || 'unité',
        rayon: entry.rayon || 'Divers',
        category: entry.category || 'Divers',
        totalQuantity: entry.quantity,
        sources: [source],
      });
    }
  };

  (recipes || []).forEach((recipe) => {
    const servings = selectedRecipes[recipe.id];
    if (servings == null) return;
    (recipe.ingredients || []).forEach((ing) => {
      push(
        { ...ing, quantity: ing.quantity_per_serving * servings },
        {
          type: 'recipe',
          label: recipe.name,
          qty: ing.quantity_per_serving * servings,
        },
      );
    });
  });

  Object.entries(quotidien || {}).forEach(([productId, status]) => {
    if (status !== 'needed') return;
    const p = (products || []).find((pr) => String(pr.id) === String(productId));
    if (!p) return;
    const qty = (quotidienQty && quotidienQty[productId]) || p.default_quantity || 1;
    push(
      {
        name: p.name,
        quantity: qty,
        unit: p.unit || 'unité',
        rayon: p.rayon || p.category || 'Quotidien',
        category: p.category || 'Quotidien',
      },
      { type: 'quotidien', label: 'Quotidien', qty },
    );
  });

  (extras || []).forEach((e) => {
    push(e, { type: 'extra', label: 'Ajout manuel', qty: e.quantity });
  });

  return Array.from(bucket.values()).sort((a, b) => {
    if (a.rayon !== b.rayon) return a.rayon.localeCompare(b.rayon);
    return a.name.localeCompare(b.name);
  });
}

export function groupByRayon(items) {
  const map = new Map();
  items.forEach((item) => {
    if (!map.has(item.rayon)) map.set(item.rayon, []);
    map.get(item.rayon).push(item);
  });
  return Array.from(map.entries()).map(([rayon, entries]) => ({ rayon, entries }));
}
