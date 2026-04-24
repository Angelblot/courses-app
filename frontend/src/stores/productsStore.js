import { create } from 'zustand';
import { CategoriesAPI, ProductsAPI } from '../api.js';
import { useUIStore } from './uiStore.js';

export const useProductsStore = create((set, get) => ({
  items: [],
  loading: false,
  loaded: false,
  categories: [],
  activeCategory: null,

  load: async () => {
    set({ loading: true });
    try {
      const [items, categories] = await Promise.all([
        ProductsAPI.list(),
        CategoriesAPI.list().catch(() => []),
      ]);
      set({ items, categories, loaded: true });
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

  setActiveCategory: (key) => {
    const normalized = key && key !== 'all' ? key : null;
    if (get().activeCategory === normalized) return;
    set({ activeCategory: normalized });
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
      return updated;
    } catch (err) {
      useUIStore.getState().notifyError(err);
      throw err;
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

  toggleFavorite: async (id) => {
    const product = get().items.find((p) => p.id === id);
    if (!product) return;
    try {
      await get().update(id, { favorite: !product.favorite });
    } catch (_err) {
      // Error already surfaced via toast in update().
    }
  },
}));
