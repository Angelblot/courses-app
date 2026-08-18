import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // Configuration manquante : on préfère un échec bruyant au démarrage
  // qu'une app qui tourne sans auth sans que personne ne s'en aperçoive.
  throw new Error(
    'VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définies (voir frontend/.env.example)'
  );
}

export const supabase = createClient(url, key);
