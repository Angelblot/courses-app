import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { EtatReprise } from '../lib/reprise-photo';

const CHAMPS = 'image_url, image_originale, image_reprise, reprise_statut, reprise_le';

/**
 * État de la reprise de photo d'un produit, relu toutes les 4 secondes tant
 * qu'elle est en cours : la fonction `ameliorer-photo` travaille en
 * arrière-plan et écrit son résultat sur le produit.
 */
export function useReprise(produitId: string | null) {
  const [etat, setEtat] = useState<EtatReprise | null>(null);
  const vivant = useRef(true);
  const recharger = useCallback(async () => {
    if (!produitId) { setEtat(null); return; }
    const { data, error } = await supabase.from('products').select(CHAMPS).eq('id', produitId).maybeSingle();
    if (vivant.current && !error) setEtat((data as EtatReprise | null) ?? null);
  }, [produitId]);
  useEffect(() => { vivant.current = true; void recharger(); return () => { vivant.current = false; }; }, [recharger]);
  useEffect(() => {
    if (etat?.reprise_statut !== 'en_cours') return;
    const t = setInterval(() => { void recharger(); }, 4000);
    return () => clearInterval(t);
  }, [etat?.reprise_statut, recharger]);
  return { etat, recharger, setEtat };
}

/** Lance la reprise ; elle continue même si la fiche est fermée. */
export async function demanderReprise(produitId: string): Promise<{ ok: boolean; erreur?: string }> {
  const { data, error } = await supabase.functions.invoke('ameliorer-photo', { body: { produit_id: produitId } });
  if (error || !data?.ok) return { ok: false, erreur: data?.erreur ?? 'La photo n’a pas pu être envoyée. Réessaie.' };
  return { ok: true };
}

/** Garde la photo reprise ; la photo d'avant reste disponible pour y revenir. */
export async function garderReprise(produitId: string, e: EtatReprise): Promise<boolean> {
  const { error } = await supabase.from('products').update({
    image_url: e.image_reprise, image_originale: e.image_originale ?? e.image_url, image_reprise: null, reprise_statut: null,
  }).eq('id', produitId);
  return !error;
}

/** Refuse la photo reprise : la photo actuelle ne change pas. */
export async function refuserReprise(produitId: string): Promise<boolean> {
  const { error } = await supabase.from('products').update({ image_reprise: null, reprise_statut: null }).eq('id', produitId);
  return !error;
}

/** Revient à la photo Open Food Facts d'origine, après l'avoir remplacée. */
export async function remettreOriginale(produitId: string, e: EtatReprise): Promise<boolean> {
  if (!e.image_originale) return false;
  const { error } = await supabase.from('products').update({ image_url: e.image_originale, image_originale: null }).eq('id', produitId);
  return !error;
}
