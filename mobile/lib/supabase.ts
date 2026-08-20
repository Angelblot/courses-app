import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  // Échec bruyant au démarrage : une application qui tourne sans
  // configuration donnerait des écrans vides sans cause visible.
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY doivent être définies (voir mobile/.env.example)',
  );
}

export const supabase = createClient(url, key, {
  auth: {
    // AsyncStorage est indispensable en React Native : sans lui la session
    // est perdue à chaque redémarrage de l'application.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
