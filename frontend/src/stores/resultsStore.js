import { create } from 'zustand';
import { WizardAPI } from '../api.js';
import { useUIStore } from './uiStore.js';

// Structure attendue d'un résultat drive :
//   { name, display_name, total, currency: 'EUR',
//     items: [{ name, quantity, unit, unit_price, price, url }],
//     missing: [{ name, quantity, unit, search_url }] }

export const useResultsStore = create((set) => ({
  loading: false,
  sessionId: null,
  results: null, // { drives: { carrefour: {...}, leclerc: {...} } }

  load: async (sessionId) => {
    set({ loading: true, sessionId });
    try {
      // TODO backend : la vraie API doit alimenter cet objet.
      const data = await WizardAPI.getResults(sessionId);
      set({ results: data });
    } catch (err) {
      // Fallback de démo — à retirer quand le backend sera en place.
      set({ results: buildMockResults(sessionId) });
      // On n'affiche pas d'erreur pour garder l'UX lisse tant que l'endpoint
      // n'est pas prêt.
    } finally {
      set({ loading: false });
    }
  },

  reset: () => set({ loading: false, sessionId: null, results: null }),
}));

function buildMockResults(sessionId) {
  return {
    session_id: sessionId,
    generated_at: new Date().toISOString(),
    drives: {
      carrefour: {
        name: 'carrefour',
        display_name: 'Carrefour Drive',
        total: 48.72,
        currency: 'EUR',
        items: [
          { name: 'Spaghetti 500g', quantity: 1, unit: 'paquet', unit_price: 1.29, price: 1.29, url: '#' },
          { name: 'Viande hachée 5%', quantity: 500, unit: 'g', unit_price: 0.023, price: 11.5, url: '#' },
          { name: 'Sauce tomate Panzani', quantity: 2, unit: 'boîte', unit_price: 1.8, price: 3.6, url: '#' },
        ],
        missing: [
          { name: 'Pâte de curry', quantity: 60, unit: 'g', search_url: '#' },
        ],
      },
      leclerc: {
        name: 'leclerc',
        display_name: 'E.Leclerc Drive',
        total: 46.15,
        currency: 'EUR',
        items: [
          { name: 'Spaghetti 500g', quantity: 1, unit: 'paquet', unit_price: 1.15, price: 1.15, url: '#' },
          { name: 'Viande hachée 5%', quantity: 500, unit: 'g', unit_price: 0.021, price: 10.5, url: '#' },
          { name: 'Sauce tomate', quantity: 2, unit: 'boîte', unit_price: 1.55, price: 3.1, url: '#' },
        ],
        missing: [],
      },
    },
  };
}
