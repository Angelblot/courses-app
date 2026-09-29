import { supabase } from './supabase';
import type { ItemPanier } from './consolidation.ts';

/**
 * Dépose la liste dans `cart_jobs`, à l'état `pending`, sous l'identifiant
 * `id` créé sur le téléphone (voir id-envoi.ts).
 *
 * L'extension Chrome connectée au même compte relève ces travaux.
 * Le remplissage ne démarre qu'après confirmation dans son popup.
 *
 * Un nouvel essai avec le même `id` après une réponse perdue heurte la clé
 * primaire : l'envoi est alors déjà parti, c'est un succès, pas un doublon.
 */
export async function envoyerListe(
  items: ItemPanier[],
  drives: string[],
  id: string,
): Promise<{ ok: boolean; id?: string; erreur?: string }> {
  const { data: utilisateur } = await supabase.auth.getUser();
  const userId = utilisateur?.user?.id;
  if (!userId) return { ok: false, erreur: 'Session expirée. Reconnecte-toi.' };

  const { error } = await supabase
    .from('cart_jobs')
    .insert({ id, user_id: userId, status: 'pending', drives, items });

  if (error) {
    if (error.code === '23505') return { ok: true, id };
    return { ok: false, erreur: "Impossible d'envoyer la liste pour le moment." };
  }
  return { ok: true, id };
}

/**
 * L'envoi `id` existe-t-il ? Après une coupure, l'insertion a pu réussir sans
 * que la réponse arrive : on relit cet identifiant exact avant de proposer de
 * réessayer. `null` si on ne peut pas le savoir (réseau toujours coupé).
 */
export async function envoiExiste(id: string): Promise<boolean | null> {
  // Une seule tentative, bornée : hors ligne, la réponse doit venir vite.
  const arret = new AbortController(), minuterie = setTimeout(() => arret.abort(), 4000);
  try {
    const { data, error } = await supabase.from('cart_jobs').select('id').eq('id', id).limit(1).retry(false).abortSignal(arret.signal);
    if (error) return null;
    return (data ?? []).length > 0;
  } finally { clearTimeout(minuterie); }
}
