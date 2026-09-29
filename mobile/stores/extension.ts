import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * L'extension Chrome a-t-elle déjà pris en charge un envoi ? Elle note
 * `claimed_at` quand elle relève un travail : s'il n'y en a aucun, elle n'a
 * sans doute jamais été installée ou connectée à ce compte.
 *
 * `null` tant qu'on ne sait pas, ou si la lecture échoue : dans le doute,
 * on ne bloque pas l'envoi.
 */
export function useExtensionConnue(actif: boolean): boolean | null {
  const [connue, setConnue] = useState<boolean | null>(null);
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    (async () => {
      const { data, error } = await supabase.from('cart_jobs').select('id').not('claimed_at', 'is', null).limit(1);
      if (!vivant) return;
      if (error) { console.error('[extension]', error); setConnue(null); return; }
      setConnue((data ?? []).length > 0);
    })();
    return () => { vivant = false; };
  }, [actif]);
  return connue;
}
