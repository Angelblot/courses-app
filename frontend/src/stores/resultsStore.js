import { create } from 'zustand';
import { WizardAPI } from '../api.js';
let requestId = 0;
export const useResultsStore = create((set, get) => ({
  loading: false,
  sessionId: null,
  results: null,
  error: null,
  load: async (sessionId) => {
    const request = ++requestId;
    set({ loading: true, error: null, sessionId, results: get().sessionId === sessionId ? get().results : null });
    try {
      const results = await WizardAPI.getResults(sessionId);
      if (request === requestId) set({ results });
    } catch {
      if (request === requestId) set({ error: 'Le suivi est indisponible pour le moment. Aucun résultat n’a pu être confirmé.' });
    } finally {
      if (request === requestId) set({ loading: false });
    }
  },
  reset: () => { requestId++; set({ loading: false, sessionId: null, results: null, error: null }); },
}));
