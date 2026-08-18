import { create } from 'zustand';
import { WizardAPI } from '../api.js';

// Structure d'un résultat drive renvoyé par GET /api/wizard/sessions/:id/results :
//   { name, display_name, total, currency: 'EUR',
//     items: [{ name, quantity, unit, unit_price, price, url }],
//     missing: [{ name, quantity, unit, search_url }] }

export const useResultsStore = create((set, get) => ({
  loading: false,
  error: null,
  sessionId: null,
  results: null, // { session_id, status, drives: { carrefour: {...}, leclerc: {...} } }

  load: async (sessionId) => {
    set({ loading: true, error: null, sessionId });
    try {
      const data = await WizardAPI.getResults(sessionId);
      set({ results: data, error: null });
    } catch (err) {
      // Pas de données de démonstration : afficher des prix inventés serait pire
      // que de ne rien afficher. On remonte l'erreur telle quelle à l'écran.
      set({ results: null, error: err?.message || 'Erreur inconnue' });
    } finally {
      set({ loading: false });
    }
  },

  retry: () => {
    const { sessionId, load } = get();
    if (sessionId) load(sessionId);
  },

  reset: () => set({ loading: false, error: null, sessionId: null, results: null }),
}));
