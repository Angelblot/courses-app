import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { OffreRelevee } from '../lib/recherche-drive.ts';
import type { Remplacement, Remplacements } from '../lib/remplacement.ts';

const CHAMPS = 'id, recherche_id, recherche, drive, libelle, marque, ean13, url, image_url, prix, prix_unitaire, unite_prix, grammage_g, volume_ml, nutriscore, promotion, disponible, rang, vu_le';

export type OffreVueTravail = OffreRelevee & { recherche: string | null };

/** Les offres vues par l'extension pendant ce remplissage, tous drives confondus. */
export function useOffresTravail(jobId: string | null) {
  const [offres, setOffres] = useState<OffreVueTravail[]>([]), [chargement, setChargement] = useState(!!jobId);
  useEffect(() => {
    if (!jobId) return;
    let vivant = true;
    void (async () => {
      const { data, error } = await supabase.from('offres_drive').select(CHAMPS).eq('cart_job_id', jobId).order('rang', { ascending: true }).limit(3000);
      if (error) console.error('[useOffresTravail]', error);
      if (!vivant) return;
      setOffres(((data ?? []) as OffreVueTravail[]).map(o => ({ ...o, prix: o.prix == null ? null : Number(o.prix), prix_unitaire: o.prix_unitaire == null ? null : Number(o.prix_unitaire) })));
      setChargement(false);
    })();
    return () => { vivant = false; };
  }, [jobId]);
  return { offres, chargement };
}

const cle = (jobId: string) => `remplacements:${jobId}`;

/**
 * Les remplacements choisis pour un remplissage, gardés sur le téléphone :
 * le compte rendu les montre en revenant, jusqu'à ce qu'on les envoie.
 */
export function useRemplacements(jobId: string | null) {
  const [remplacements, setRemplacements] = useState<Remplacements>({});
  useEffect(() => {
    setRemplacements({});
    if (!jobId) return;
    // Un choix fait avant la fin de la lecture n'est pas écrasé par elle.
    AsyncStorage.getItem(cle(jobId)).then(v => { if (v) setRemplacements(prev => ({ ...(JSON.parse(v) as Remplacements), ...prev })); }).catch(() => {});
  }, [jobId]);
  // Toujours depuis l'état le plus récent : un choix arrive après deux appels réseau.
  const modifier = useCallback((f: (prev: Remplacements) => Remplacements) => setRemplacements(prev => {
    const suite = f(prev);
    if (jobId) {
      const vide = !Object.values(suite).some(d => Object.keys(d).length);
      (vide ? AsyncStorage.removeItem(cle(jobId)) : AsyncStorage.setItem(cle(jobId), JSON.stringify(suite))).catch(() => {});
    }
    return suite;
  }), [jobId]);
  const choisir = useCallback((drive: string, item: string, r: Remplacement) => modifier(prev => ({ ...prev, [drive]: { ...prev[drive], [item]: r } })), [modifier]);
  const oublier = useCallback((drive: string, item: string) => modifier(prev => { const { [item]: _, ...reste } = prev[drive] ?? {}; return { ...prev, [drive]: reste }; }), [modifier]);
  const oublierDrive = useCallback((drive: string) => modifier(prev => { const { [drive]: _, ...reste } = prev; return reste; }), [modifier]);
  return { remplacements, choisir, oublier, oublierDrive };
}

/**
 * Le remplaçant passe en tête des alternatives du produit d'origine : la
 * prochaine fois, l'extension l'essaie dès que la référence manque.
 */
export async function retenirAlternative(origineId: string | null, remplacantId: string | null, ancienId: string | null = null): Promise<void> {
  if (!origineId || origineId === remplacantId) return;
  const { data } = await supabase.from('products').select('alternatives').eq('id', origineId).maybeSingle();
  // Un choix changé ou retiré ne reste pas en alternative.
  const reste = (((data?.alternatives as string[] | null) ?? []).filter(x => x !== remplacantId && x !== ancienId));
  const alternatives = remplacantId ? [remplacantId, ...reste] : reste;
  const { error } = await supabase.from('products').update({ alternatives }).eq('id', origineId);
  if (error) console.error('[retenirAlternative]', error);
}
