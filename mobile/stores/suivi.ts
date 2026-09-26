import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { cleEcart, doitAfficher, ETATS_ACTIFS } from '../lib/suivi-bandeau.ts';
import { lireAcquittement, ecrireAcquittement } from './acquittement';

export type Travail = {
  id: string;
  status: string;
  /** Sert à oublier un travail que l'extension n'a jamais pris en charge. */
  created_at?: string;
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
        .select('id, status, progress, results, error, created_at')
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

/**
 * Suit le travail à signaler, quel qu'il soit.
 *
 * Distinct de `useSuiviTravail`, qui suit un travail dont on connaît déjà
 * l'identifiant : ici on ne le connaît pas, et la requête comme l'abonnement
 * en diffèrent.
 *
 * L'abonnement ne porte aucun filtre d'identifiant ; RLS garantit que seuls
 * les travaux de l'utilisateur remontent. `cart_jobs` est déjà publiée dans
 * `supabase_realtime` — vérifié le 22/08.
 */
export function useTravailActif() {
  const [travail, setTravail] = useState<Travail | null>(null);
  const [dernierAcquitte, setDernierAcquitte] = useState<string | null>(null);

  const relire = useCallback(async () => {
    const { data, error } = await supabase
      .from('cart_jobs')
      .select('id, status, progress, results, error, created_at')
      .in('status', [...ETATS_ACTIFS, 'done', 'failed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('[travailActif]', error);
      return;
    }
    setTravail((data as Travail) ?? null);
  }, []);

  useEffect(() => {
    let vivant = true;
    lireAcquittement().then((v) => { if (vivant) setDernierAcquitte(v); });
    relire();

    const canal = supabase
      .channel('travail-actif')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cart_jobs' },
        // On relit plutôt que de se fier à la charge de l'événement : une
        // insertion et une mise à jour n'ont pas la même forme, et le travail
        // le plus récent peut changer d'identité.
        () => { if (vivant) relire(); },
      )
      .subscribe();

    return () => {
      vivant = false;
      supabase.removeChannel(canal);
    };
  }, [relire]);

  const acquitte = useCallback(async (id: string) => {
    await ecrireAcquittement(id);
    setDernierAcquitte(id);
  }, []);

  /** Écarte le bandeau pour l'état courant, sans toucher au travail lui-même. */
  const ecarter = useCallback(async () => {
    if (!travail) return;
    const cle = cleEcart(travail);
    await ecrireAcquittement(cle);
    setDernierAcquitte(cle);
  }, [travail]);

  const aMontrer = doitAfficher(travail, dernierAcquitte) ? travail : null;
  return { travail: aMontrer, acquitte, ecarter };
}
