import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type Travail = {
  id: string;
  status: string;
  progress: { drive?: string; fait?: number; total?: number } | null;
  results: Record<string, Array<{ item: string; ok: boolean; message?: string }>> | null;
  error: string | null;
};

/**
 * Suit un travail de remplissage en temps réel.
 *
 * `cart_jobs` est déjà publiée dans `supabase_realtime` — vérifié le 22/08.
 * Une première lecture précède l'abonnement : sans elle, l'écran resterait
 * vide jusqu'au premier changement, qui peut ne jamais venir si le Mac a fini
 * avant qu'on regarde.
 */
export function useSuiviTravail(jobId: string | null) {
  const [travail, setTravail] = useState<Travail | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!jobId) {
      setChargement(false);
      return;
    }
    let vivant = true;

    (async () => {
      const { data, error } = await supabase
        .from('cart_jobs')
        .select('id, status, progress, results, error')
        .eq('id', jobId)
        .maybeSingle();
      if (!vivant) return;
      if (error) console.error('[suivi]', error);
      setTravail((data as Travail) ?? null);
      setChargement(false);
    })();

    const canal = supabase
      .channel(`travail-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cart_jobs', filter: `id=eq.${jobId}` },
        (message) => { if (vivant) setTravail(message.new as Travail); },
      )
      .subscribe();

    return () => {
      vivant = false;
      supabase.removeChannel(canal);
    };
  }, [jobId]);

  return { travail, chargement };
}
