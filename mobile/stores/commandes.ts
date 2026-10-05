import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { commandesDesFactures, commandesDesPaniers, toutesCommandes, type Commande } from '../lib/commandes.ts';

/**
 * Toutes les commandes du foyer : factures importées et paniers remplis par
 * l'extension. `cle` relance la lecture, par exemple quand un remplissage
 * vient de se terminer.
 */
export function useCommandes(cle?: unknown) {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [chargement, setChargement] = useState(true), [erreur, setErreur] = useState<string | null>(null);
  const recharger = useCallback(async () => {
    setChargement(true);
    const [f, t, o] = await Promise.all([
      supabase.from('purchase_lines').select('commande, purchase_date, drive, magasin, product_id, ean13, libelle, quantity_delivered, total_ttc, unit_price_ttc')
        .not('commande', 'is', null).order('purchase_date', { ascending: false }).limit(5000),
      supabase.from('cart_jobs').select('id, status, created_at, finished_at, results').eq('status', 'done').order('created_at', { ascending: false }).limit(60),
      supabase.from('offres_drive').select('cart_job_id, drive, product_id, libelle, ean13, prix').eq('choisi', true).not('cart_job_id', 'is', null)
        .order('vu_le', { ascending: false }).limit(5000),
    ]);
    if (f.error || t.error || o.error) { console.error('[commandes]', f.error ?? t.error ?? o.error); setErreur('Impossible de charger tes commandes. Réessaie.'); }
    else { setErreur(null); setCommandes(toutesCommandes(commandesDesFactures(f.data ?? []), commandesDesPaniers(Array.isArray(t.data) ? t.data : [], Array.isArray(o.data) ? o.data : []))); }
    setChargement(false);
  }, []);
  useEffect(() => { void recharger(); }, [recharger, cle]);
  return { commandes, chargement, erreur, recharger };
}
