/**
 * Décision d'afficher le bandeau de suivi.
 *
 * Fonction pure, sans accès au réseau ni au stockage : c'est la règle la plus
 * facile à se tromper, et la seule qu'on puisse éprouver sous Node.
 */

/** Un travail dans l'un de ces états mérite qu'on le signale. */
export const ETATS_ACTIFS = ['pending', 'claimed', 'running', 'needs_action'] as const;

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
export function doitAfficher(
  travail: { id: string; status: string } | null,
  dernierAcquitte: string | null,
): boolean {
  if (!travail) return false;
  if (estActif(travail.status)) return true;
  if (estClos(travail.status)) return travail.id !== dernierAcquitte;
  return false;
}
