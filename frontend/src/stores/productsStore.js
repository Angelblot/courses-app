import { create } from 'zustand';
import { ProductsAPI } from '../api.js';
import { useUIStore } from './uiStore.js';

export const useProductsStore = create((set, get) => ({
  items: [],
  loading: false,
  loaded: false,

  load: async () => {
    set({ loading: true });
    try {
      const items = await ProductsAPI.list();
      set({ items, loaded: true });
    } catch (err) {
      useUIStore.getState().notifyError(err);
    } finally {
      set({ loading: false });
    }
  },

  loadByDrive: async (driveName) => {
    set({ loading: true });
    try {
      const items = await ProductsAPI.list(
        driveName ? { drive: driveName } : undefined,
      );
      set({ items, loaded: true });
    } catch (err) {
      useUIStore.getState().notifyError(err);
    } finally {
      set({ loading: false });
    }
  },

  create: async (payload) => {
    try {
      const created = await ProductsAPI.create(payload);
      set((state) => ({ items: [...state.items, created] }));
      useUIStore.getState().notifySuccess('Produit ajouté');
      return created;
    } catch (err) {
      useUIStore.getState().notifyError(err);
      throw err;
    }
  },

  update: async (id, patch) => {
    try {
      const updated = await ProductsAPI.update(id, patch);
      set((state) => ({
        items: state.items.map((p) => (p.id === id ? { ...p, ...updated } : p)),
      }));
    } catch (err) {
      useUIStore.getState().notifyError(err);
    }
  },

  remove: async (id) => {
    try {
      await ProductsAPI.delete(id);
      set((state) => ({ items: state.items.filter((p) => p.id !== id) }));
    } catch (err) {
      useUIStore.getState().notifyError(err);
    }
  },

  toggleFavorite: (id) => {
    const product = get().items.find((p) => p.id === id);
    if (!product) return;
    return get().update(id, { favorite: !product.favorite });
  },
}));
