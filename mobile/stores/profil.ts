import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const lire = (meta: Record<string, unknown> | undefined) => (typeof meta?.prenom === 'string' && meta.prenom.trim() ? meta.prenom.trim() : null);

/**
 * Le prénom de la personne connectée, gardé dans son profil (user_metadata) :
 * propre à chacun, même dans un foyer partagé. Suit les changements faits
 * ailleurs dans l'app.
 */
export function usePrenom() {
  const [prenom, setPrenom] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setPrenom(lire(data.user?.user_metadata)));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setPrenom(lire(session?.user?.user_metadata)));
    return () => data.subscription.unsubscribe();
  }, []);
  const enregistrer = useCallback(async (valeur: string): Promise<{ ok: boolean; erreur?: string }> => {
    const propre = valeur.trim().slice(0, 40);
    const { data, error } = await supabase.auth.updateUser({ data: { prenom: propre || null } });
    if (error) { console.error('[prenom]', error); return { ok: false, erreur: 'Impossible d’enregistrer ton prénom. Réessaie.' }; }
    setPrenom(lire(data.user?.user_metadata));
    return { ok: true };
  }, []);
  return { prenom, enregistrer };
}
