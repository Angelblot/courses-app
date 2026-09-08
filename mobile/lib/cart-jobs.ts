import { supabase } from './supabase';
import type { ItemPanier } from './consolidation.ts';

/**
 * Dépose la liste dans `cart_jobs`, à l'état `pending`.
 *
 * L'extension Chrome connectée au même compte relève ces travaux.
 * Le remplissage ne démarre qu'après confirmation dans son popup.
 */
export async function envoyerListe(
  items: ItemPanier[],
  drives: string[],
): Promise<{ ok: boolean; id?: string; erreur?: string }> {
  const { data: utilisateur } = await supabase.auth.getUser();
  const userId = utilisateur?.user?.id;
  if (!userId) return { ok: false, erreur: 'Session expirée. Reconnecte-toi.' };

  // L'identifiant est renvoyé : c'est lui que l'écran de suivi observe.
  const { data, error } = await supabase
    .from('cart_jobs')
    .insert({ user_id: userId, status: 'pending', drives, items })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[envoyerListe]', error);
    return { ok: false, erreur: "Impossible d'envoyer la liste pour le moment." };
  }
  return { ok: true, id: data.id as string };
}
