/**
 * Recherches demandées depuis l'app (table recherches_drive) : dans quel
 * ordre les faire, à quel rythme, et ce qu'on en retient. Logique pure, sans
 * réseau ni chrome.*, pour rester testable sous node --test.
 */

/** Carrefour d'abord, E.Leclerc ensuite : son anti-robot est le plus sensible. */
const ORDRE_DRIVES = ['carrefour', 'leclerc'];

/**
 * Les recherches à faire, groupées par drive dans l'ordre de passage, les plus
 * anciennes d'abord. Une recherche restée « en cours » (extension fermée en
 * route) ou interrompue par une vérification se refait.
 */
export function fileDeRecherches(recherches) {
  const aFaire = (recherches ?? []).filter((r) => ['en_attente', 'en_cours', 'verification'].includes(r.statut));
  return ORDRE_DRIVES
    .map((drive) => ({
      drive,
      // Les fiches d'abord : quelqu'un attend devant le comparatif.
      recherches: aFaire
        .filter((r) => r.drive === drive)
        .sort((a, b) => Number(b.type === 'fiche') - Number(a.type === 'fiche') || String(a.demandee_le).localeCompare(String(b.demandee_le))),
    }))
    .filter((g) => g.recherches.length);
}

/**
 * Pause entre deux recherches : de 8 à 15 secondes, tirée au hasard, comme
 * une personne qui lit les résultats avant de taper la suivante. S'ajoute au
 * rythme de navigation (lib/rythme.js), jamais en dessous.
 */
export function pauseEntreRecherches(alea = Math.random()) {
  const a = Math.min(1, Math.max(0, Number(alea) || 0));
  return Math.round(8000 + a * 7000);
}

/** L'adresse de la recherche sur ce drive, dans le magasin choisi. */
export function adresseRecherche(cfg, baseOrigin, requete) {
  const q = encodeURIComponent(requete);
  return cfg.searchPath && baseOrigin ? baseOrigin + cfg.searchPath.replace('{q}', q) : cfg.searchUrl.replace('{q}', q);
}

/**
 * Le statut d'une recherche après passage de l'agent de page. Une
 * vérification n'est pas un échec : il faut rendre la main et s'arrêter.
 */
export function issueRecherche(compteRendu, nombreOffres) {
  if (compteRendu?.reason === 'challenge') return 'verification';
  if (nombreOffres > 0) return 'faite';
  if (compteRendu?.ok || ['no_results', 'no_match', 'product_unavailable'].includes(compteRendu?.reason)) return 'vide';
  return 'echec';
}

/**
 * Les drives sur lesquels lancer les recherches tout seul, au passage de
 * l'alarme : ceux qui ont des recherches en attente, si le réglage est actif
 * et que rien ne tourne. Une pause demandée par l'utilisateur arrête tout ;
 * une vérification ou un magasin à choisir n'arrête que son drive : un
 * magasin E.Leclerc introuvable ne bloque plus les fiches Carrefour.
 */
export function drivesAuto({ auto, recherches, occupe, etat }) {
  if (!auto || occupe) return [];
  if (etat?.statut === 'pause' && etat.cause === 'manuel') return [];
  const bloque = etat?.statut === 'pause' && ['verification', 'magasin'].includes(etat.cause) ? etat.driveBloque ?? null : null;
  return [...new Set((recherches ?? []).filter((r) => ['en_attente', 'en_cours'].includes(r.statut)).map((r) => r.drive))]
    .filter((d) => d !== bloque);
}
