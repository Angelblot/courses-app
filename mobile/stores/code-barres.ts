import { supabase } from '../lib/supabase';
import { lookupEan, type FicheProduit, type ResultatRecherche } from '../lib/openfoodfacts.ts';
import { ficheDepuisDrives, type AchatVu, type OffreVue } from '../lib/fiche-drive.ts';

/**
 * Ce que l'app a déjà vu de ce code-barres sur les drives : offres relevées
 * par l'extension et lignes de factures du foyer. null si rien, ou si la
 * base n'a pas répondu.
 */
async function ficheDesDrives(ean: string): Promise<FicheProduit | null> {
  const [offres, achats] = await Promise.all([
    supabase.from('offres_drive').select('drive, libelle, marque, image_url, prix, grammage_g, volume_ml, nutriscore, vu_le')
      .eq('ean13', ean).order('vu_le', { ascending: false }).limit(5),
    supabase.from('purchase_lines').select('drive, libelle, unit_price_ttc, purchase_date')
      .eq('ean13', ean).order('purchase_date', { ascending: false }).limit(5),
  ]);
  if (offres.error && achats.error) return null;
  return ficheDepuisDrives(ean, (offres.data ?? []) as OffreVue[], (achats.data ?? []) as AchatVu[]);
}

/**
 * Le produit d'un code-barres scanné : les bases ouvertes d'abord (Open Food
 * Facts, puis ses sœurs beauté et maison), sinon ce que les drives en ont
 * montré. Jamais de requête aux drives eux-mêmes.
 */
export async function chercherCodeBarres(ean: string): Promise<ResultatRecherche> {
  const r = await lookupEan(ean);
  if (r.etat === 'trouve') return r;
  const vue = await ficheDesDrives(ean);
  return vue ? { etat: 'trouve', fiche: vue } : r;
}
