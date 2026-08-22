/** Libellés et garde-fous du foyer. Aucun code technique n'atteint l'écran. */

export function libelleMembre(m: { role: string; joined_at: string | null }): string {
  if (m.role === 'createur') return 'A créé le foyer';
  return m.joined_at ? 'Membre' : 'Invité, en attente';
}

/**
 * Dit si `moi` peut retirer `cible`.
 *
 * On ne peut retirer ni soi-même, ni un créateur : un foyer sans créateur
 * serait un foyer dont personne ne peut plus gérer les accès, et un foyer sans
 * membre un foyer dont les données deviennent inaccessibles à tous.
 *
 * La même règle est écrite dans la politique RLS : celle-ci fait foi, celle-là
 * évite de proposer un geste qui sera refusé.
 */
export function peutRetirer(
  moi: { role: string; user_id: string },
  cible: { role: string; user_id: string },
): boolean {
  if (moi.role !== 'createur') return false;
  if (moi.user_id === cible.user_id) return false;
  if (cible.role === 'createur') return false;
  return true;
}
