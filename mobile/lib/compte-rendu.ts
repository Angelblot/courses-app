/**
 * Le compte rendu d'un remplissage, drive par drive (variante B validée) :
 * ce qui est au panier, ce qui ne l'est pas et pourquoi, en mots humains.
 * Logique pure, sans Supabase ni React Native.
 */

/** Une ligne telle que l'extension la renvoie dans `cart_jobs.results`. */
export type LigneResultat = {
  item: string;
  ok: boolean;
  message?: string;
  reason?: string;
  /** Le libellé du produit mis au panier, quand il diffère du nom cherché. */
  label?: string;
  quantity?: number;
  searchUrl?: string;
  /** Aucun essai possible ici : la référence est une marque d'une autre enseigne. */
  autreEnseigne?: boolean;
};

export type Ton = 'danger' | 'attention' | 'neutre';
export type Raison = { libelle: string; ton: Ton; action: string };

const NOMS: Record<string, string> = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' };
const SITES: Record<string, string> = { carrefour: 'carrefour.fr', leclerc: 'leclercdrive.fr' };

export const nomDrive = (d: string) => NOMS[d] ?? d;
export const siteDrive = (d: string) => SITES[d] ?? d;

/** Pourquoi une ligne n'est pas au panier, et le geste qui la reprend sur le site. */
export function raison(l: LigneResultat, drive: string, drives: string[]): Raison {
  switch (l.reason) {
    case 'product_unavailable':
      if (l.autreEnseigne) {
        // Attendu, pas une panne : la référence est une marque de l'autre enseigne.
        const autre = drives.length === 2 ? drives.find(d => d !== drive) : undefined;
        return { libelle: autre ? `Marque ${nomDrive(autre)}` : 'Marque d’une autre enseigne', ton: 'neutre', action: 'Remplacer' };
      }
      return { libelle: 'En rupture', ton: 'danger', action: 'Remplacer' };
    case 'no_add_button':
      return { libelle: 'En rupture', ton: 'danger', action: 'Remplacer' };
    case 'no_results':
    case 'no_match':
    case 'wrong_product':
      return { libelle: 'Introuvable', ton: 'attention', action: 'Chercher' };
    case 'ambiguous':
    case 'candidate_gone':
      return { libelle: 'Plusieurs produits possibles', ton: 'attention', action: 'Choisir' };
    case 'click_no_effect':
      return { libelle: 'Ajout refusé par le site', ton: 'danger', action: 'Réessayer' };
    case 'inject_failed':
    case 'no_result':
      return { libelle: 'Le site n’a pas répondu', ton: 'attention', action: 'Réessayer' };
    default:
      return { libelle: 'Non ajouté', ton: 'attention', action: 'Chercher' };
  }
}

/** Marques propres des enseignes : chez le concurrent, la recherche se fait sans elles. */
const MARQUES_ENSEIGNE = /\b(bio village|marque rep[eè]re|reflets de france|eco\+|carrefour (?:sensation|bio|extra|classic|original|essential)|carrefour|les croisés|nos régions ont du talent)\b/gi;

/** Le nom à chercher chez l'autre enseigne : sans sa marque propre ni les mots tout en capitales. */
export function requeteSansMarque(nom: string): string {
  const sans = nom.replace(MARQUES_ENSEIGNE, ' ')
    .split(/\s+/).filter(m => !(m.length > 3 && /\p{L}/u.test(m) && m === m.toUpperCase() && !/\d/.test(m)))
    .join(' ').replace(/\s+-\s*$/, '').replace(/\s{2,}/g, ' ').trim();
  return sans.length >= 3 ? sans : nom;
}

export type BilanDrive = { drive: string; ajoutes: LigneResultat[]; manquants: LigneResultat[]; total: number };

/** Un bilan par drive, dans l'ordre du remplissage. */
export function bilanParDrive(results: Record<string, LigneResultat[] | null | undefined> | null | undefined): BilanDrive[] {
  return Object.entries(results ?? {}).map(([drive, lignes]) => {
    const l = lignes ?? [];
    return { drive, ajoutes: l.filter(x => x.ok), manquants: l.filter(x => !x.ok), total: l.length };
  });
}

const hoteSur = (u: string, drive: string): URL | null => {
  try {
    const url = new URL(u);
    if (url.protocol !== 'https:') return null;
    const h = url.hostname;
    const sur = drive === 'carrefour' ? h === 'www.carrefour.fr' : drive === 'leclerc' ? h === 'www.leclercdrive.fr' || h.endsWith('.leclercdrive.fr') : false;
    return sur ? url : null;
  } catch { return null; }
};

/**
 * L'adresse où reprendre une ligne : la recherche faite par l'extension, sur
 * le site du drive seulement (la ligne vient de la base). Sinon une recherche
 * construite, dans le magasin vu sur une autre ligne du même drive : chez
 * E.Leclerc, l'accueil nu ne désigne aucun magasin. Une marque de l'autre
 * enseigne est retirée de ce qu'on cherche.
 */
export function adresseReprise(l: LigneResultat, drive: string, autres: LigneResultat[] = []): string {
  const propre = l.searchUrl ? hoteSur(l.searchUrl, drive) : null;
  if (propre && !l.autreEnseigne) return propre.toString();
  const q = encodeURIComponent(l.autreEnseigne ? requeteSansMarque(l.item) : l.item);
  if (drive === 'leclerc') {
    const vue = autres.map(x => (x.searchUrl ? hoteSur(x.searchUrl, drive) : null)).find(Boolean);
    const magasin = vue ? vue.origin + (vue.pathname.match(/^\/magasin-[^/.]+/)?.[0] ?? '') : 'https://www.leclercdrive.fr';
    return `${magasin}/recherche.aspx?TexteRecherche=${q}`;
  }
  return `https://www.carrefour.fr/s?q=${q}&noRedirect=1`;
}
