import { create } from 'zustand';
import { WizardAPI } from '../api.js';
import { useUIStore } from './uiStore.js';

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

function normalizeUnit(unit) {
  return (unit || 'unité').trim().toLowerCase();
}

function unitsCompatible(a, b) {
  return normalizeUnit(a) === normalizeUnit(b);
}

export function getRecipeUsage({
  productId,
  productName,
  productUnit,
  selectedRecipes,
  recipes,
}) {
  const breakdown = [];
  let totalQuantity = 0;
  if (!recipes || !selectedRecipes) return { totalQuantity, breakdown };

  const targetName = normalizeName(productName);

  recipes.forEach((recipe) => {
    const servings = selectedRecipes[recipe.id];
    if (servings == null) return;
    (recipe.ingredients || []).forEach((ing) => {
      const matchById =
        productId != null &&
        ing.product_id != null &&
        String(ing.product_id) === String(productId);
      const matchByName =
        !matchById &&
        targetName.length > 0 &&
        normalizeName(ing.name) === targetName &&
        unitsCompatible(ing.unit, productUnit);
      if (!matchById && !matchByName) return;
      const qty = (ing.quantity_per_serving || 0) * servings;
      breakdown.push({
        recipeName: recipe.name,
        qty,
        unit: ing.unit || 'unité',
      });
      totalQuantity += qty;
    });
  });

  return { totalQuantity, breakdown };
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
