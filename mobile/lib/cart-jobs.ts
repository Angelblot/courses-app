import { supabase } from './supabase';
import type { ItemPanier } from './consolidation.ts';

/**
 * Dépose la liste dans `cart_jobs`, à l'état `pending`, sous l'identifiant
 * `id` créé sur le téléphone (voir id-envoi.ts).
 *
 * L'extension Chrome connectée au même compte relève ces travaux et lance
 * d'elle-même le plus récent. Les listes envoyées avant et jamais relevées
 * sont annulées : l'extension ne doit pas remplir une liste d'il y a un mois.
 *
 * Un nouvel essai avec le même `id` après une réponse perdue heurte la clé
 * primaire : l'envoi est alors déjà parti, c'est un succès, pas un doublon.
 */
export async function envoyerListe(
  items: ItemPanier[],
  drives: string[],
  id: string,
  { annulerAnciennes = true }: { annulerAnciennes?: boolean } = {},
): Promise<{ ok: boolean; id?: string; erreur?: string }> {
  const { data: utilisateur } = await supabase.auth.getUser();
  const userId = utilisateur?.user?.id;
  if (!userId) return { ok: false, erreur: 'Session expirée. Reconnecte-toi.' };

  const { error } = await supabase
    .from('cart_jobs')
    .insert({ id, user_id: userId, status: 'pending', drives, items });

  if (error && error.code !== '23505') return { ok: false, erreur: "Impossible d'envoyer la liste pour le moment." };
  // Sans conséquence si cela échoue : l'extension ne prend de toute façon que la plus récente.
  // Un complément (des remplacements) s'ajoute à ce qui attend, sans rien annuler.
  if (annulerAnciennes) await supabase.from('cart_jobs').update({ status: 'cancelled' }).eq('user_id', userId).eq('status', 'pending').neq('id', id);
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
