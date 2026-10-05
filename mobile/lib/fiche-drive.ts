/**
 * Une fiche produit tirée de ce que l'app a déjà vu sur les drives, quand
 * aucune base ouverte ne connaît le code-barres : les offres relevées par
 * l'extension pendant un vrai remplissage de panier, et les lignes des
 * factures. Aucune requête aux drives : leurs anti-robots bloqueraient
 * l'adresse de la famille. Rien ici ne parle à Supabase.
 */
import { quandAchete } from './historique-prix.ts';
import { normalizeProductType } from './typology.ts';
import type { FicheProduit } from './openfoodfacts.ts';

/** Une offre de `offres_drive`, telle que lue en base. */
export type OffreVue = {
  drive: string; libelle: string; marque: string | null; image_url: string | null;
  prix: number | string | null; grammage_g: number | string | null; volume_ml: number | string | null;
  nutriscore: string | null; vu_le: string;
};

/** Une ligne de facture de `purchase_lines`. */
export type AchatVu = {
  drive: string | null; libelle: string | null; unit_price_ttc: number | string | null; purchase_date: string | null;
};

const NOMS: Record<string, string> = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' };
const euros = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const nombre = (v: number | string | null) => { const n = Number(v); return v != null && Number.isFinite(n) && n > 0 ? n : null; };

/**
 * La fiche, ou null si rien n'a été vu. Le nom, la photo et la contenance
 * viennent de l'offre la plus récente, plus complète qu'une facture ; la
 * mention « Vu chez » cite la trace la plus récente, offre ou achat.
 */
export function ficheDepuisDrives(ean: string, offres: OffreVue[], achats: AchatVu[], aujourdhui = new Date()): FicheProduit | null {
  const offre = offres.filter(o => o.libelle?.trim()).sort((a, b) => b.vu_le.localeCompare(a.vu_le))[0];
  const achat = achats.filter(a => a.libelle?.trim() && a.purchase_date).sort((a, b) => b.purchase_date!.localeCompare(a.purchase_date!))[0];
  if (!offre && !achat) return null;
  const jourOffre = offre?.vu_le.slice(0, 10), jourAchat = achat?.purchase_date?.slice(0, 10);
  const trace = offre && (!jourAchat || jourOffre! >= jourAchat)
    ? { drive: offre.drive, jour: jourOffre!, prix: nombre(offre.prix) }
    : { drive: achat!.drive ?? 'carrefour', jour: jourAchat!, prix: nombre(achat!.unit_price_ttc) };
  const name = (offre?.libelle ?? achat!.libelle!).trim();
  const note = offre?.nutriscore?.toLowerCase();
  return {
    ean13: ean,
    name,
    brand: offre?.marque?.trim() || null,
    imageUrl: offre?.image_url || null,
    grammageG: nombre(offre?.grammage_g ?? null),
    volumeMl: nombre(offre?.volume_ml ?? null),
    productType: normalizeProductType(name),
    categoryKey: null,
    nutriscore: note && 'abcde'.includes(note) && note.length === 1 ? note as FicheProduit['nutriscore'] : null,
    origine: [`Vu chez ${NOMS[trace.drive] ?? trace.drive}`, quandAchete(trace.jour, aujourdhui), trace.prix ? euros(trace.prix) : null]
      .filter(Boolean).join(' · '),
  };
}
