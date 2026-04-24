import { create } from 'zustand';
import { DrivesAPI } from '../api.js';
import { useUIStore } from './uiStore.js';

export const useDrivesStore = create((set) => ({
  configs: [],
  loading: false,
  testResult: null,

  load: async () => {
    set({ loading: true });
    try {
      const configs = await DrivesAPI.configs();
      set({ configs });
    } catch (err) {
      useUIStore.getState().notifyError(err);
    } finally {
      set({ loading: false });
    }
  },

  create: async (form) => {
    const payload = {
      name: form.name,
      display_name: form.display_name || form.name,
      enabled: true,
      default_store: form.default_store,
      credentials_json: JSON.stringify({
        email: form.email,
        password: form.password,
        store: form.default_store,
      }),
    };
    try {
      const created = await DrivesAPI.createConfig(payload);
      set((state) => ({ configs: [...state.configs, created] }));
      useUIStore.getState().notifySuccess('Drive ajouté');
      return created;
    } catch (err) {
      useUIStore.getState().notifyError(err);
    }
  },

  testConnection: async (name) => {
    set({ testResult: { loading: true, name } });
    try {
      const result = await DrivesAPI.testConnection(name);
      set({ testResult: { ...result, name } });
    } catch (err) {
      set({ testResult: { success: false, message: err.message, name } });
    }
  },

  clearTestResult: () => set({ testResult: null }),
}));
