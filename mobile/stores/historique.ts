import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { historiquePrix, type Historique } from '../lib/historique-prix.ts';

const VIDE: Historique = { achats: [], dernier: null, ecart: null, depuis: null };

/** L'historique des prix d'un produit, ou une erreur affichable. */
export async function chargerHistorique(produitId: string, ean13?: string | null): Promise<{ historique: Historique } | { erreur: string }> {
  const filtre = ean13 && /^\d{8,14}$/.test(ean13) ? `product_id.eq.${produitId},ean13.eq.${ean13}` : `product_id.eq.${produitId}`;
  const [f, r] = await Promise.all([
    supabase.from('purchase_lines').select('purchase_date, drive, magasin, commande, quantity_delivered, unit_price_ttc, remise_ttc, total_ttc')
      .or(filtre).order('purchase_date', { ascending: true }).limit(500),
    supabase.from('offres_drive').select('vu_le, drive, prix, promotion').eq('product_id', produitId).eq('choisi', true)
      .order('vu_le', { ascending: true }).limit(500),
  ]);
  if (f.error || r.error) { console.error('[historique]', f.error ?? r.error); return { erreur: 'Impossible de charger les prix payés. Réessaie.' }; }
  return { historique: historiquePrix(f.data ?? [], r.data ?? []) };
}

/**
 * Prix payés pour un produit : les lignes de factures, par produit ou par
 * code-barres, et les prix relevés par l'extension au moment de le mettre
 * au panier.
 */
export function useHistoriquePrix(produitId: string, ean13?: string | null) {
  const [historique, setHistorique] = useState<Historique>(VIDE);
  const [chargement, setChargement] = useState(true), [erreur, setErreur] = useState<string | null>(null);
  const recharger = useCallback(async () => {
    setChargement(true);
    const r = await chargerHistorique(produitId, ean13);
    if ('erreur' in r) setErreur(r.erreur); else { setErreur(null); setHistorique(r.historique); }
    setChargement(false);
  }, [produitId, ean13]);
  useEffect(() => { void recharger(); }, [recharger]);
  return { historique, chargement, erreur, recharger };
}
