import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Achat, Lien } from '../lib/deja-achete.ts';

/**
 * L'historique utile pour reconnaître tes produits dans les offres d'une
 * recherche : les liens retenus avec chaque enseigne, et les commandes des
 * produits proches ou dont le code-barres figure parmi les offres. Vide si la
 * base ne répond pas : la liste reste celle du drive.
 */
export function useDejaAchete(produitIds: string[], eans: string[]) {
  const [donnees, setDonnees] = useState<{ achats: Achat[]; liens: Lien[] }>({ achats: [], liens: [] });
  const cle = [...produitIds].sort().join(',') + '|' + [...eans].sort().join(',');
  useEffect(() => {
    let actif = true;
    (async () => {
      const { data: l } = await supabase.from('product_equivalents').select('product_id, drive, matched_label, product_url, ean13');
      const liens = (l ?? []) as Lien[];
      // Requête bornée : les produits proches du nom cherché, et les codes-barres des offres (chiffres seulement).
      const ids = produitIds.filter(x => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 40);
      const codes = eans.filter(x => /^\d{8,14}$/.test(x)).slice(0, 80);
      const filtres = [ids.length ? `product_id.in.(${ids.join(',')})` : null, codes.length ? `ean13.in.(${codes.join(',')})` : null].filter(Boolean).join(',');
      const { data: a } = filtres
        ? await supabase.from('purchase_lines').select('product_id, drive, libelle, ean13, unit_price_ttc, purchase_date').or(filtres).order('purchase_date', { ascending: false }).limit(1000)
        : { data: [] };
      const achats = ((a ?? []) as { product_id: string | null; drive: string; libelle: string | null; ean13: string | null; unit_price_ttc: number | string | null; purchase_date: string | null }[])
        .map(x => ({ product_id: x.product_id, drive: x.drive, libelle: x.libelle, ean13: x.ean13, prix: x.unit_price_ttc == null ? null : Number(x.unit_price_ttc), date: x.purchase_date }));
      if (actif) setDonnees({ achats, liens });
    })().catch(() => { /* sans historique, la liste reste celle du drive */ });
    return () => { actif = false; };
  }, [cle]);
  return donnees;
}
