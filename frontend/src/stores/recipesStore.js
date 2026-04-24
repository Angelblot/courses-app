import { create } from 'zustand';
import { RecipesAPI } from '../api.js';
import { useUIStore } from './uiStore.js';

export const useRecipesStore = create((set, get) => ({
  items: [],
  loading: false,
  loaded: false,

  load: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const items = await RecipesAPI.list();
      set({ items, loaded: true });
    } catch (err) {
      useUIStore.getState().notifyError(err);
    } finally {
      set({ loading: false });
    }
  },

  create: async (payload) => {
    try {
      const created = await RecipesAPI.create(payload);
      set((state) => ({ items: [...state.items, created] }));
      useUIStore.getState().notifySuccess('Recette ajoutée');
      return created;
    } catch (err) {
      useUIStore.getState().notifyError(err);
      throw err;
    }
  },

  remove: async (id) => {
    try {
      await RecipesAPI.delete(id);
      set((state) => ({ items: state.items.filter((r) => r.id !== id) }));
    } catch (err) {
      useUIStore.getState().notifyError(err);
    }
  },
}));
