import { create } from 'zustand';
import { supabase } from '../lib/supabase.js';

// Messages d'erreur Supabase → français humain.
const ERROR_MESSAGES = {
  'Invalid login credentials': 'E-mail ou mot de passe incorrect.',
  'Email not confirmed': 'Confirme ton adresse via le lien reçu par e-mail.',
  'User already registered': 'Un compte existe déjà avec cette adresse.',
  'Password should be at least 6 characters':
    'Le mot de passe doit faire au moins 6 caractères.',
};

function humanize(error) {
  if (!error) return null;
  return ERROR_MESSAGES[error.message] || error.message;
}

export const useAuthStore = create((set) => ({
  // 'loading' tant que la session initiale n'est pas connue : évite un flash
  // de l'écran de connexion quand une session valide existe déjà.
  status: 'loading', // 'loading' | 'signed_in' | 'signed_out'
  session: null,
  error: null,
  submitting: false,
  // Après inscription, Supabase attend la confirmation e-mail.
  awaitingConfirmation: false,

  init: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({
        session: data.session,
        status: data.session ? 'signed_in' : 'signed_out',
      });
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, status: session ? 'signed_in' : 'signed_out' });
    });
  },

  signIn: async (email, password) => {
    set({ submitting: true, error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ submitting: false, error: humanize(error) });
    return !error;
  },

  signUp: async (email, password) => {
    set({ submitting: true, error: null, awaitingConfirmation: false });
    const { data, error } = await supabase.auth.signUp({ email, password });
    set({
      submitting: false,
      error: humanize(error),
      // Session absente + pas d'erreur = confirmation e-mail requise.
      awaitingConfirmation: !error && !data.session,
    });
    return !error;
  },

  signOut: async () => {
    await supabase.auth.signOut();
  },

  clearError: () => set({ error: null, awaitingConfirmation: false }),
}));

/**
 * Jeton d'accès courant, rafraîchi par supabase-js si nécessaire.
 * Renvoie null hors session.
 */
export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
