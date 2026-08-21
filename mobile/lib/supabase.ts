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
    // PKCE et non le flux implicite (défaut de supabase-js 2.112) : sur mobile,
    // le lien de récupération revient par un lien profond, et un fragment `#`
    // survit mal au passage par le système. PKCE fait porter au lien un
    // paramètre de requête `code`, qui arrive intact.
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
