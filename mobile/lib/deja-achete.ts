/**
 * Tes produits dans les résultats des drives. Un produit de ton catalogue est
 * reconnu dans une offre par son code-barres, par le libellé retenu lors d'un
 * panier précédent ou d'une commande, ou par l'adresse de sa fiche. Reconnu,
 * il remonte en tête de l'onglet de l'enseigne, avec ce que l'historique en
 * dit ; acheté là sans figurer dans les derniers résultats, il y reste
 * proposé avec son dernier prix. Rien ici ne parle à Supabase.
 */
import type { DriveRecherche, OffreRelevee } from './recherche-drive.ts';
import { normaliserNom } from './session-courses.ts';

/** Une ligne de commande passée. */
export type Achat = { product_id: string | null; drive: string; libelle: string | null; ean13: string | null; prix: number | null; date: string | null };
/** Le lien retenu entre un de tes produits et une enseigne. */
export type Lien = { product_id: string; drive: string; matched_label: string | null; product_url: string | null; ean13: string | null };
export type ProduitConnu = {
  id: string; name: string; brand?: string | null; ean13: string | null; image_url: string | null;
  grammage_g?: number | null; volume_ml?: number | null;
};
export type Connu = { produit: ProduitConnu; offre: OffreRelevee; achats: number; absent: boolean };

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const jour = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : `${d.getDate()} ${MOIS[d.getMonth()]}`; };

/** « Acheté 3 fois · dernier le 12 sept. », « Acheté une fois », « Dans tes produits ». */
export function histoireDe(achats: Achat[]): string {
  if (!achats.length) return 'Dans tes produits';
  const dernier = achats.map(a => a.date).filter((d): d is string => !!d).sort().pop();
  const quand = dernier ? jour(dernier) : null;
  return [achats.length === 1 ? 'Acheté une fois' : `Acheté ${achats.length} fois`, quand ? `dernier le ${quand}` : null].filter(Boolean).join(' · ');
}

/**
 * Les produits déjà connus d'une enseigne pour cette recherche : reconnus dans
 * ses offres d'abord (les plus achetés en tête), puis ceux achetés là mais
 * absents des résultats, parmi les produits proches du nom cherché.
 */
export function dejaAchetes(drive: DriveRecherche, offres: OffreRelevee[], produits: ProduitConnu[], achats: Achat[], liens: Lien[], proches: string[], max = 3): Connu[] {
  const ici = offres.filter(o => o.drive === drive), prises = new Set<string>(), connus: Connu[] = [];
  for (const p of produits) {
    const sesAchats = achats.filter(a => a.product_id === p.id && a.drive === drive);
    const sesLiens = liens.filter(l => l.product_id === p.id && l.drive === drive);
    const eans = new Set([p.ean13, ...sesAchats.map(a => a.ean13), ...sesLiens.map(l => l.ean13)].filter((x): x is string => !!x));
    const libelles = new Set([...sesLiens.map(l => l.matched_label), ...sesAchats.map(a => a.libelle)].filter((x): x is string => !!x).map(normaliserNom));
    const adresses = new Set(sesLiens.map(l => l.product_url).filter((x): x is string => !!x));
    const offre = ici.find(o => !prises.has(o.id) && ((!!o.ean13 && eans.has(o.ean13)) || libelles.has(normaliserNom(o.libelle)) || (!!o.url && adresses.has(o.url))));
    const histoire = sesAchats.length ? histoireDe(sesAchats) : sesLiens.length ? 'Déjà choisi ici' : 'Dans tes produits';
    if (offre) {
      prises.add(offre.id);
      connus.push({ produit: p, achats: sesAchats.length, absent: false, offre: { ...offre, produit_id: p.id, histoire } });
    } else if ((sesAchats.length || sesLiens.length) && proches.includes(p.id)) {
      const dernier = [...sesAchats].filter(a => a.prix != null).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
      connus.push({ produit: p, achats: sesAchats.length, absent: true, offre: {
        id: `historique:${p.id}:${drive}`, recherche_id: '', drive, libelle: p.name, marque: p.brand ?? null, ean13: p.ean13,
        url: sesLiens[0]?.product_url ?? null, image_url: p.image_url, prix: dernier?.prix ?? null, prix_unitaire: null, unite_prix: null,
        grammage_g: p.grammage_g ?? null, volume_ml: p.volume_ml ?? null, nutriscore: null, promotion: null, disponible: true, rang: null,
        vu_le: dernier?.date ?? '', produit_id: p.id, historique: true, histoire,
      } });
    }
  }
  return connus.sort((a, b) => Number(a.absent) - Number(b.absent) || b.achats - a.achats).slice(0, max);
}
