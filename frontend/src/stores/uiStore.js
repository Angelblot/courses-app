import { create } from 'zustand';

let nextId = 1;

export const useUIStore = create((set, get) => ({
  toasts: [],

  pushToast: (toast) => {
    const id = nextId++;
    const entry = { id, variant: 'info', ...toast };
    set((state) => ({ toasts: [...state.toasts, entry] }));
    setTimeout(() => get().dismissToast(id), toast.duration ?? 4000);
    return id;
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  notifyError: (err) =>
    get().pushToast({ variant: 'danger', message: err?.message || String(err) }),

  notifySuccess: (message) =>
    get().pushToast({ variant: 'success', message }),

  notifyInfo: (message) =>
    get().pushToast({ variant: 'info', message }),
}));
