import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { achatsDesEnvois, type Achat, type Offre } from '../lib/comparateur.ts';

const CHAMPS = 'drive, product_id, recherche, libelle, marque, ean13, url, image_url, prix, prix_unitaire, unite_prix, grammage_g, volume_ml, nutriscore, promotion, disponible, choisi, vu_le';

/**
 * Offres relevées par l'extension sur les deux derniers mois, et achats
 * passés lus dans les envois au drive terminés : de quoi comparer et
 * proposer des pistes. `productId` restreint aux alternatives d'un produit.
 */
export function useOffres(productId?: string) {
  const [offres, setOffres] = useState<Offre[]>([]), [achats, setAchats] = useState<Achat[]>([]);
  const [chargement, setChargement] = useState(true), [erreur, setErreur] = useState<string | null>(null);
  const recharger = useCallback(async () => {
    setChargement(true);
    const depuis = new Date(Date.now() - 60 * 86400000).toISOString();
    let requete = supabase.from('offres_drive').select(CHAMPS).gte('vu_le', depuis).order('vu_le', { ascending: false }).limit(2000);
    if (productId) requete = requete.eq('product_id', productId);
    const [o, e] = await Promise.all([
      requete,
      supabase.from('cart_jobs').select('status, created_at, items').eq('status', 'done').order('created_at', { ascending: false }).limit(60),
    ]);
    if (o.error || e.error) { console.error('[offres]', o.error ?? e.error); setErreur('Impossible de charger les prix relevés. Réessaie.'); }
    else { setErreur(null); setOffres((o.data ?? []) as Offre[]); setAchats(achatsDesEnvois(e.data ?? [])); }
    setChargement(false);
  }, [productId]);
  useEffect(() => { void recharger(); }, [recharger]);
  return { offres, achats, chargement, erreur, recharger };
}
