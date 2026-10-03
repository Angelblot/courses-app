import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { indexerFaits, type FaitsLiens } from '../lib/liens.ts';
import type { Enseigne } from '../lib/references.ts';

/**
 * Ce que chaque drive connaît des produits : achats (factures, tickets),
 * produits mis au panier par l'extension, fiches mémorisées ou absences.
 * `produitId` restreint la lecture à un produit (sa fiche).
 */
export function useLiens(produitId?: string) {
  const [faits, setFaits] = useState<Map<string, FaitsLiens>>(new Map());
  const [chargement, setChargement] = useState(true), [erreur, setErreur] = useState<string | null>(null);
  const recharger = useCallback(async () => {
    setChargement(true);
    let achats = supabase.from('purchase_lines').select('product_id, drive').not('product_id', 'is', null).gt('quantity_delivered', 0).limit(10000);
    let paniers = supabase.from('offres_drive').select('product_id, drive').eq('choisi', true).not('product_id', 'is', null).limit(10000);
    let equivalences = supabase.from('product_equivalents').select('product_id, drive, unavailable').limit(5000);
    if (produitId) { achats = achats.eq('product_id', produitId); paniers = paniers.eq('product_id', produitId); equivalences = equivalences.eq('product_id', produitId); }
    const [a, o, e] = await Promise.all([achats, paniers, equivalences]);
    if (a.error || o.error || e.error) { console.error('[liens]', a.error ?? o.error ?? e.error); setErreur('Impossible de lire les liens aux drives. Réessaie.'); }
    else { setErreur(null); setFaits(indexerFaits([...(a.data ?? []), ...(o.data ?? [])], e.data ?? [])); }
    setChargement(false);
  }, [produitId]);
  useEffect(() => { void recharger(); }, [recharger]);
  return { faits, chargement, erreur, recharger };
}

/**
 * Marque un produit absent d'un drive, ou retire cette mention. L'extension
 * ne cherche plus un produit absent : elle passe à l'alternative suivante.
 */
export async function marquerAbsent(produitId: string, drive: Enseigne, absent: boolean, nom: string): Promise<{ ok: boolean; erreur?: string }> {
  const { error } = absent
    ? await supabase.from('product_equivalents').upsert(
      { product_id: produitId, drive, unavailable: true, search_query: nom, last_confirmed_at: new Date().toISOString() },
      { onConflict: 'user_id,product_id,drive' })
    : await supabase.from('product_equivalents').delete().eq('product_id', produitId).eq('drive', drive).eq('unavailable', true);
  if (error) { console.error('[marquerAbsent]', error); return { ok: false, erreur: 'Impossible d’enregistrer. Réessaie.' }; }
  return { ok: true };
}
