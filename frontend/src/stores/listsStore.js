import { create } from 'zustand';
import { ListsAPI } from '../api.js';
import { useUIStore } from './uiStore.js';

export const useListsStore = create((set, get) => ({
  lists: [],
  selected: null,
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const lists = await ListsAPI.list();
      set({ lists });
    } catch (err) {
      useUIStore.getState().notifyError(err);
    } finally {
      set({ loading: false });
    }
  },

  select: async (id) => {
    if (id === null) {
      set({ selected: null });
      return;
    }
    try {
      const detail = await ListsAPI.get(id);
      set({ selected: detail });
    } catch (err) {
      useUIStore.getState().notifyError(err);
    }
  },

  refreshSelected: async () => {
    const current = get().selected;
    if (!current) return;
    await get().select(current.id);
    await get().load();
  },

  create: async (name) => {
    if (!name?.trim()) return;
    try {
      const created = await ListsAPI.create({ name: name.trim() });
      set((state) => ({ lists: [...state.lists, created] }));
      useUIStore.getState().notifySuccess('Liste créée');
      return created;
    } catch (err) {
      useUIStore.getState().notifyError(err);
    }
  },

  addItem: async (productId, quantity = 1) => {
    const list = get().selected;
    if (!list) return;
    try {
      await ListsAPI.addItem(list.id, { product_id: productId, quantity });
      await get().refreshSelected();
    } catch (err) {
      useUIStore.getState().notifyError(err);
    }
  },

  toggleItem: async (item) => {
    const list = get().selected;
    if (!list) return;
    try {
      await ListsAPI.updateItem(list.id, item.id, { checked: !item.checked });
      await get().refreshSelected();
    } catch (err) {
      useUIStore.getState().notifyError(err);
    }
  },

  removeItem: async (itemId) => {
    const list = get().selected;
    if (!list) return;
    try {
      await ListsAPI.deleteItem(list.id, itemId);
      await get().refreshSelected();
    } catch (err) {
      useUIStore.getState().notifyError(err);
    }
  },

  generateFromFavorites: async () => {
    const list = get().selected;
    if (!list) return;
    try {
      await ListsAPI.generateFromFavorites(list.id);
      await get().refreshSelected();
      useUIStore.getState().notifySuccess('Favoris ajoutés');
    } catch (err) {
      useUIStore.getState().notifyError(err);
    }
  },
}));
