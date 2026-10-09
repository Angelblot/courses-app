import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { lireExtension, type EtatExtension, type LignePresence } from '../lib/extension-presence.ts';
import { nomCanal } from '../lib/canal';

/**
 * Ce que fait l'extension Chrome du foyer, en temps réel : elle réécrit sa
 * ligne à chaque étape et chaque minute. On relit aussi toutes les 30
 * secondes, pour voir l'ordinateur disparaître quand Chrome se ferme.
 */
export function useExtension(): EtatExtension | null {
  const [ligne, setLigne] = useState<LignePresence | null | undefined>(undefined);
  const [, setTic] = useState(0);

  useEffect(() => {
    let vivant = true;
    const relire = async () => {
      const { data, error } = await supabase.from('extension_presence').select('vue_le, activite, detail').maybeSingle();
      if (error) { console.error('[useExtension]', error); return; }
      if (vivant) setLigne((data as LignePresence | null) ?? null);
    };
    void relire();
    const canal = supabase.channel(nomCanal('extension-presence'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'extension_presence' }, (m) => { if (vivant && m.new) setLigne(m.new as LignePresence); })
      .subscribe();
    const minuteur = setInterval(() => setTic(t => t + 1), 30_000);
    return () => { vivant = false; clearInterval(minuteur); supabase.removeChannel(canal); };
  }, []);

  return ligne === undefined ? null : lireExtension(ligne);
}
