const API_URL = import.meta.env.PROD
  ? 'https://courses-app-backend-3gwn.onrender.com'
  : ''; // Dev: Vite proxy vers localhost:8000

async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res.json();
}

function toQuery(params) {
  if (!params) return '';
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return qs ? `?${qs}` : '';
}

export const ProductsAPI = {
  list: (params) => api(`/api/products/${toQuery(params)}`),
  create: (data) => api('/api/products/', { method: 'POST', body: data }),
  update: (id, data) => api(`/api/products/${id}`, { method: 'PUT', body: data }),
  delete: (id) => api(`/api/products/${id}`, { method: 'DELETE' }),
  getPriceHistory: (id) => api(`/api/products/${id}/price-history`),
};

export const CategoriesAPI = {
  list: () => api('/api/categories/'),
};

export const ListsAPI = {
  list: () => api('/api/lists/'),
  create: (data) => api('/api/lists/', { method: 'POST', body: data }),
  get: (id) => api(`/api/lists/${id}`),
  addItem: (listId, data) => api(`/api/lists/${listId}/items`, { method: 'POST', body: data }),
  updateItem: (listId, itemId, data) =>
    api(`/api/lists/${listId}/items/${itemId}`, { method: 'PUT', body: data }),
  deleteItem: (listId, itemId) =>
    api(`/api/lists/${listId}/items/${itemId}`, { method: 'DELETE' }),
  generateFromFavorites: (id) =>
    api(`/api/lists/${id}/generate-from-favorites`, { method: 'POST' }),
};

export const DrivesAPI = {
  configs: () => api('/api/drives/configs'),
  createConfig: (data) => api('/api/drives/configs', { method: 'POST', body: data }),
  testConnection: (name) => api(`/api/drives/${name}/test-connection`, { method: 'POST' }),
  addToCart: (name, items) =>
    api(`/api/drives/${name}/add-to-cart`, { method: 'POST', body: items }),
  search: (name, query) =>
    api(`/api/drives/${name}/search?query=${encodeURIComponent(query)}`),
};

// Jeu de recettes de démo utilisé tant que l'endpoint /api/recipes/ n'existe pas.
// À retirer dès que le backend expose l'API.
const FALLBACK_RECIPES = [
  {
    id: 'demo-1',
    name: 'Pâtes bolognaise',
    description: 'Classique familial, rapide.',
    servings_default: 4,
    category: 'Plats',
    image_url: null,
    ingredients: [
      { name: 'Spaghetti', quantity_per_serving: 100, unit: 'g', rayon: 'Épicerie', category: 'Pâtes' },
      { name: 'Viande hachée', quantity_per_serving: 125, unit: 'g', rayon: 'Boucherie', category: 'Viande' },
      { name: 'Sauce tomate', quantity_per_serving: 100, unit: 'g', rayon: 'Épicerie', category: 'Conserves' },
      { name: 'Oignon', quantity_per_serving: 0.5, unit: 'unité', rayon: 'Fruits & légumes', category: 'Légumes' },
      { name: 'Parmesan', quantity_per_serving: 15, unit: 'g', rayon: 'Crèmerie', category: 'Fromages' },
    ],
  },
  {
    id: 'demo-2',
    name: 'Salade César',
    description: 'Légère et gourmande.',
    servings_default: 2,
    category: 'Entrées',
    image_url: null,
    ingredients: [
      { name: 'Salade romaine', quantity_per_serving: 0.5, unit: 'unité', rayon: 'Fruits & légumes', category: 'Légumes' },
      { name: 'Blanc de poulet', quantity_per_serving: 120, unit: 'g', rayon: 'Boucherie', category: 'Viande' },
      { name: 'Parmesan', quantity_per_serving: 20, unit: 'g', rayon: 'Crèmerie', category: 'Fromages' },
      { name: 'Croûtons', quantity_per_serving: 30, unit: 'g', rayon: 'Épicerie', category: 'Apéritif' },
    ],
  },
  {
    id: 'demo-3',
    name: 'Curry de légumes',
    description: 'Végé, épicé, réconfortant.',
    servings_default: 4,
    category: 'Plats',
    image_url: null,
    ingredients: [
      { name: 'Riz basmati', quantity_per_serving: 80, unit: 'g', rayon: 'Épicerie', category: 'Riz' },
      { name: 'Lait de coco', quantity_per_serving: 100, unit: 'ml', rayon: 'Épicerie', category: 'Conserves' },
      { name: 'Pois chiches', quantity_per_serving: 80, unit: 'g', rayon: 'Épicerie', category: 'Conserves' },
      { name: 'Oignon', quantity_per_serving: 0.5, unit: 'unité', rayon: 'Fruits & légumes', category: 'Légumes' },
      { name: 'Carotte', quantity_per_serving: 1, unit: 'unité', rayon: 'Fruits & légumes', category: 'Légumes' },
      { name: 'Pâte de curry', quantity_per_serving: 15, unit: 'g', rayon: 'Épicerie', category: 'Épices' },
    ],
  },
];

// TODO backend — endpoints à créer côté FastAPI :
//   GET    /api/recipes/                  → liste les recettes
//   POST   /api/recipes/                  → crée une recette
//   GET    /api/recipes/:id               → détail (avec ingrédients)
//   PUT    /api/recipes/:id
//   DELETE /api/recipes/:id
// Modèle attendu :
//   { id, name, description, servings_default, category, image_url,
//     ingredients: [{ product_id?, name, quantity_per_serving, unit, rayon, category }] }
export const RecipesAPI = {
  list: async () => {
    try {
      return await api('/api/recipes/');
    } catch (e) {
      return FALLBACK_RECIPES;
    }
  },
  get: (id) => api(`/api/recipes/${id}`),
  create: (data) => api('/api/recipes/', { method: 'POST', body: data }),
  update: (id, data) => api(`/api/recipes/${id}`, { method: 'PUT', body: data }),
  delete: (id) => api(`/api/recipes/${id}`, { method: 'DELETE' }),
};

// TODO backend — endpoints à créer pour le wizard "Phase de courses" :
//   POST /api/wizard/sessions
//     body: {
//       recipes: [{ recipe_id, servings }],
//       quotidien: [{ product_id, needed: bool }],
//       extras: [{ name, quantity, unit, rayon, category }]
//     }
//     → { id, consolidated_items }
//   GET  /api/wizard/sessions/:id
//   POST /api/wizard/sessions/:id/generate
//     body: { drives: ['carrefour', 'leclerc'] }
//     → { job_id }
//   GET  /api/wizard/sessions/:id/results
//     → { drives: { carrefour: {items:[], missing:[], total:N}, leclerc: {...} } }
export const WizardAPI = {
  createSession: (data) => api('/api/wizard/sessions', { method: 'POST', body: data }),
  getSession: (id) => api(`/api/wizard/sessions/${id}`),
  launchGeneration: (id, data) =>
    api(`/api/wizard/sessions/${id}/generate`, { method: 'POST', body: data }),
  getResults: (id) => api(`/api/wizard/sessions/${id}/results`),
};
