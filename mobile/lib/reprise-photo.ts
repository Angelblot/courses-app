/**
 * « Améliorer la photo » : quand le bouton s'affiche, et quand une reprise
 * restée « en cours » doit être tenue pour échouée (fonction coupée).
 */
export type EtatReprise = {
 image_url: string | null;
 image_originale: string | null;
 image_reprise: string | null;
 reprise_statut: 'en_cours' | 'prete' | 'echec' | null;
 reprise_le: string | null;
};

/** Une reprise dure moins d'une minute ; au-delà de trois, elle a échoué. */
export const DUREE_MAX_MS = 3 * 60 * 1000;

export const estPhotoOpenFoodFacts = (url: string | null | undefined) => !!url && /(^|\.)openfoodfacts\.org\//.test(url.replace(/^https?:\/\//, ''));

/** Ce que la fiche montre sous la photo. */
export function phaseReprise(e: EtatReprise | null, maintenant: number): 'proposer' | 'en_cours' | 'choisir' | 'echec' | 'rien' {
 if (!e) return 'rien';
 if (e.reprise_statut === 'prete' && e.image_reprise) return 'choisir';
 if (e.reprise_statut === 'en_cours') {
  const depuis = e.reprise_le ? maintenant - Date.parse(e.reprise_le) : Infinity;
  return depuis > DUREE_MAX_MS ? 'echec' : 'en_cours';
 }
 if (e.reprise_statut === 'echec') return 'echec';
 return estPhotoOpenFoodFacts(e.image_url) ? 'proposer' : 'rien';
}
