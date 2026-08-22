/** Textes de l'écran de suivi. Aucun code technique ne doit atteindre l'écran. */

const ETATS: Record<string, string> = {
  pending: 'En attente de ton Mac',
  claimed: 'Prise en charge',
  running: 'Remplissage en cours',
  needs_action: 'Ton intervention est nécessaire',
  done: 'Panier rempli',
  failed: 'Le remplissage a échoué',
  cancelled: 'Annulé',
};

const DRIVES: Record<string, string> = {
  carrefour: 'Carrefour',
  leclerc: 'E.Leclerc',
};

export function libelleEtat(statut: string): string {
  return ETATS[statut] ?? 'État inconnu';
}

export function libelleDrive(cle: string | undefined): string {
  return DRIVES[cle ?? ''] ?? (cle ?? '');
}

/**
 * Phrase d'état sous le titre.
 *
 * Elle ne montre un compte que lorsqu'il en existe un : afficher « 0 sur 0 »
 * pendant l'attente laisserait croire qu'un remplissage a commencé.
 */
export function resume(travail: {
  status: string;
  progress?: { drive?: string; fait?: number; total?: number } | null;
  error?: string | null;
}): string {
  const p = travail.progress ?? {};
  if (travail.status === 'running' && p.fait != null && p.total != null) {
    return `${p.fait} sur ${p.total} chez ${libelleDrive(p.drive)}`;
  }
  if (travail.status === 'needs_action') {
    return travail.error ?? "Ouvre l'extension sur ton Mac pour reprendre.";
  }
  if (travail.status === 'pending') {
    return "Ouvre l'extension sur ton Mac : elle attend ton feu vert.";
  }
  if (travail.status === 'failed') return travail.error ?? "Réessaie depuis l'extension.";
  return libelleEtat(travail.status);
}
