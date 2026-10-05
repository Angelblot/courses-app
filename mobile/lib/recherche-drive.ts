/**
 * « Chercher sur les drives » : un produit introuvable dans les bases ouvertes
 * est cherché par l'extension, dans le Chrome de l'utilisateur, sur Carrefour
 * puis E.Leclerc. Ici, l'état de ces recherches, le choix d'au plus un produit
 * par drive, et la façon de les garder. Rien ici ne parle à Supabase.
 */
import { normalizeProductType } from './typology.ts';
import type { FicheProduit, NoteNutri } from './openfoodfacts.ts';

export type DriveRecherche = 'carrefour' | 'leclerc';
export const DRIVES_RECHERCHE: DriveRecherche[] = ['carrefour', 'leclerc'];
export const NOMS_DRIVE: Record<DriveRecherche, string> = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' };

export type StatutRecherche = 'en_attente' | 'en_cours' | 'faite' | 'vide' | 'verification' | 'echec';
export type RechercheDrive = {
  id: string; drive: DriveRecherche; requete: string; ean13: string | null;
  statut: StatutRecherche; resultats: number | null; demandee_le: string; faite_le: string | null;
};

/** Une offre relevée par l'extension pour une recherche demandée. */
export type OffreRelevee = {
  id: string; recherche_id: string; drive: DriveRecherche; libelle: string; marque: string | null;
  ean13: string | null; url: string | null; image_url: string | null;
  prix: number | null; prix_unitaire: number | null; unite_prix: 'kg' | 'l' | 'unite' | null;
  grammage_g: number | null; volume_ml: number | null; nutriscore: NoteNutri | null;
  promotion: string | null; disponible: boolean; rang: number | null; vu_le: string;
  /** Le texte utile de la fiche sur le drive, lu par l'extension pour comparer. */
  fiche_texte?: string | null;
};

const EN_ATTENTE: StatutRecherche[] = ['en_attente', 'en_cours', 'verification'];
export const estEnAttente = (s: StatutRecherche) => EN_ATTENTE.includes(s);

/** Pour chaque drive, sa recherche la plus récente pour cette requête (ou rien). */
export function dernieresParDrive(recherches: RechercheDrive[]): Partial<Record<DriveRecherche, RechercheDrive>> {
  const m: Partial<Record<DriveRecherche, RechercheDrive>> = {};
  for (const r of recherches) {
    const deja = m[r.drive];
    if (!deja || r.demandee_le > deja.demandee_le) m[r.drive] = r;
  }
  return m;
}

/**
 * Où en est la recherche : rien demandé, envoyée et pas encore revenue, ou
 * des résultats (même si l'autre drive n'a pas encore répondu).
 */
export function phase(recherches: RechercheDrive[], offres: OffreRelevee[]): 'aucune' | 'attente' | 'resultats' | 'sans_resultat' {
  const d = Object.values(dernieresParDrive(recherches));
  if (!d.length) return 'aucune';
  if (offres.length) return 'resultats';
  return d.some(r => estEnAttente(r.statut)) ? 'attente' : 'sans_resultat';
}

/** Ce que dit une ligne d'état pour un drive. */
export function libelleStatut(r: RechercheDrive | undefined): string {
  if (!r) return 'pas demandée';
  switch (r.statut) {
    case 'en_attente': return 'en file';
    case 'en_cours': return 'recherche en cours…';
    case 'verification': return 'vérification à faire dans Chrome';
    case 'faite': return `${r.resultats ?? 0} trouvé${(r.resultats ?? 0) > 1 ? 's' : ''}`;
    case 'vide': return 'rien trouvé';
    default: return 'la recherche a échoué';
  }
}

/** Les offres d'un drive, dans l'ordre où le drive les montre, disponibles d'abord. */
export function offresDuDrive(offres: OffreRelevee[], drive: DriveRecherche): OffreRelevee[] {
  return offres.filter(o => o.drive === drive)
    .sort((a, b) => Number(b.disponible) - Number(a.disponible) || (a.rang ?? 99) - (b.rang ?? 99));
}

export type ChoixParDrive = Partial<Record<DriveRecherche, string>>;

/**
 * Choisir une offre dans le comparatif : au plus une par drive. Un 2ᵉ choix
 * sur le même drive remplace le 1er ; rechoisir la même offre la retire.
 */
export function basculerChoix(choix: ChoixParDrive, offre: Pick<OffreRelevee, 'id' | 'drive'>): ChoixParDrive {
  const suite = { ...choix };
  if (suite[offre.drive] === offre.id) delete suite[offre.drive];
  else suite[offre.drive] = offre.id;
  return suite;
}

/**
 * Comment garder les offres choisies : chacune devient un produit. À deux,
 * chacune est réservée à son drive et la Carrefour passe en premier, l'autre
 * en alternative : chaque panier prend celle de son drive. Seule, elle reste
 * cherchée partout.
 */
export function planGarde(choisies: OffreRelevee[]): { offre: OffreRelevee; venduChez: DriveRecherche | null }[] {
  const tri = [...choisies].sort((a, b) => DRIVES_RECHERCHE.indexOf(a.drive) - DRIVES_RECHERCHE.indexOf(b.drive));
  const deuxDrives = new Set(tri.map(o => o.drive)).size > 1;
  return tri.map(offre => ({ offre, venduChez: deuxDrives ? offre.drive : null }));
}

/** La fiche produit d'une offre, pour l'ajouter à « Mes produits ». */
export function ficheDepuisOffre(o: OffreRelevee): FicheProduit {
  return {
    ean13: o.ean13 ?? '', name: o.libelle, brand: o.marque, imageUrl: o.image_url,
    grammageG: o.grammage_g, volumeMl: o.volume_ml, productType: normalizeProductType(o.libelle),
    categoryKey: null, nutriscore: o.nutriscore,
  };
}

/** « 3,49 € » ; « 12,40 €/kg » pour un prix unitaire. */
export function prixLisible(prix: number | null, unite?: OffreRelevee['unite_prix']): string | null {
  if (prix == null) return null;
  const t = `${prix.toFixed(2).replace('.', ',')} €`;
  return unite ? `${t}/${unite === 'unite' ? 'unité' : unite === 'l' ? 'L' : unite}` : t;
}
