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
  create: (data) => api('/api/categories/', { method: 'POST', body: data }),
  update: (key, data) => api(`/api/categories/${encodeURIComponent(key)}`, { method: 'PUT', body: data }),
  delete: (key) =>
    fetch(`${API_URL}/api/categories/${encodeURIComponent(key)}`, { method: 'DELETE' }).then(async (res) => {
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      return null;
    }),
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

const EMPTY_FALLBACK = [];

export const RecipesAPI = {
  list: async () => {
    try {
      return await api('/api/recipes/');
    } catch (e) {
      return EMPTY_FALLBACK;
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
