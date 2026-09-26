/**
 * Décision d'afficher le bandeau de suivi.
 *
 * Fonction pure, sans accès au réseau ni au stockage : c'est la règle la plus
 * facile à se tromper, et la seule qu'on puisse éprouver sous Node.
 */

/** Un travail dans l'un de ces états mérite qu'on le signale. */
export const ETATS_ACTIFS = ['pending', 'claimed', 'running', 'needs_action'] as const;

/**
 * États où rien n'a encore commencé : l'extension n'a pas ouvert le travail.
 * Ce sont les seuls qui s'oublient avec le temps.
 */
const ETATS_AVANT_DEPART = ['pending', 'claimed'] as const;

/**
 * Au-delà, un travail jamais pris en charge cesse d'être annoncé.
 *
 * Douze heures couvrent le parcours normal — composer sa liste le soir, ouvrir
 * le Mac le lendemain matin — sans laisser traîner un bandeau pendant des
 * jours. Constaté le 24/08 : un travail vieux de deux jours annonçait encore
 * « Ta liste attend sur ton Mac ».
 */
const HEURES_AVANT_OUBLI = 12;

/** Clos avec quelque chose à lire : un bilan, ou une explication d'échec. */
const ETATS_CLOS = ['done', 'failed'] as const;

export function estActif(statut: string): boolean {
  return (ETATS_ACTIFS as readonly string[]).includes(statut);
}

export function estClos(statut: string): boolean {
  return (ETATS_CLOS as readonly string[]).includes(statut);
}

/**
 * Dit si le bandeau doit apparaître.
 *
 * Un travail clos reste affiché tant qu'on ne l'a pas ouvert : c'est au bilan
 * qu'on apprend ce qui n'a pas été ajouté, et le faire disparaître tout seul
 * le ferait manquer.
 *
 * `cancelled` n'apparaît jamais : il n'y a rien à regarder.
 */
/** Clé d'écartement d'un travail dans un état donné. */
export function cleEcart(travail: { id: string; status: string }): string {
  return `${travail.id}:${travail.status}`;
}

function jamaisParti(statut: string): boolean {
  return (ETATS_AVANT_DEPART as readonly string[]).includes(statut);
}

export function doitAfficher(
  travail: { id: string; status: string; created_at?: string } | null,
  dernierAcquitte: string | null,
  maintenant: number = Date.now(),
): boolean {
  if (!travail) return false;

  // Écarter vaut pour l'état écarté, pas pour le travail : s'il change
  // d'état, il se remontre — il se passe alors quelque chose de neuf.
  if (dernierAcquitte === cleEcart(travail)) return false;

  if (estActif(travail.status)) {
    if (!jamaisParti(travail.status)) return true;
    const ne = Date.parse(travail.created_at ?? '');
    // Une date absente ou illisible n'efface rien : mieux vaut un bandeau de
    // trop qu'une liste oubliée en silence.
    if (Number.isNaN(ne)) return true;
    return maintenant - ne < HEURES_AVANT_OUBLI * 3600_000;
  }

  if (estClos(travail.status)) return travail.id !== dernierAcquitte;
  return false;
}
