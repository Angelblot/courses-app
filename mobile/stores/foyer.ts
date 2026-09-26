import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const ERREUR_CHARGEMENT =
  'Impossible de charger ton foyer. Vérifie ta connexion et réessaie.';

export type Membre = {
  id: string;
  user_id: string;
  role: string;
  joined_at: string | null;
  email: string | null;
};

export type Foyer = { id: string; name: string };

export function useFoyer() {
  const [foyer, setFoyer] = useState<Foyer | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [moi, setMoi] = useState<Membre | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  // Même garde-fou que les autres magasins : une réponse lente ne doit pas
  // écraser une réponse plus récente.
  const generation = useRef(0);

  const recharger = useCallback(async () => {
    const appel = ++generation.current;
    setChargement(true);

    const [{ data: f, error: e1 }, { data: m, error: e2 }, { data: u }] = await Promise.all([
      supabase.from('households').select('id, name').maybeSingle(),
      // La vue, et non household_members : auth.users n'est pas exposée, donc
      // sans elle on n'aurait que des identifiants à afficher.
      supabase.from('membres_du_foyer').select('id, user_id, role, joined_at, email'),
      supabase.auth.getUser(),
    ]);

    if (appel !== generation.current) return;

    if (e1 || e2) {
      console.error('[foyer]', e1 ?? e2);
      setErreur(ERREUR_CHARGEMENT);
      setFoyer(null);
      setMembres([]);
      setMoi(null);
    } else {
      setErreur(null);
      setFoyer((f as Foyer) ?? null);
      const liste = (m as Membre[]) ?? [];
      setMembres(liste);
      const monId = u?.user?.id;
      setMoi(liste.find((x) => x.user_id === monId) ?? null);
    }
    setChargement(false);
  }, []);

  useEffect(() => { recharger(); }, [recharger]);

  return { foyer, membres, moi, chargement, erreur, recharger };
}

/**
 * Invite une adresse dans le foyer.
 *
 * L'envoi passe par la fonction Edge `inviter` : elle seule dispose de la clé
 * de service, que Supabase lui fournit et qui ne doit jamais atteindre le
 * téléphone.
 */
export async function inviter(email: string): Promise<{ ok: boolean; erreur?: string }> {
  const adresse = email.trim().toLowerCase();
  if (!adresse.includes('@')) return { ok: false, erreur: 'Adresse invalide.' };

  const { data, error } = await supabase.functions.invoke('inviter', {
    body: { email: adresse },
  });

  if (error) {
    console.error('[inviter]', error);
    // Le corps d'une réponse d'erreur porte notre message français ; s'il
    // manque, c'est que l'appel n'a même pas abouti.
    const message = (data as { erreur?: string } | null)?.erreur;
    return { ok: false, erreur: message ?? "L'invitation n'a pas pu être envoyée." };
  }
  const r = data as { ok?: boolean; erreur?: string } | null;
  if (r?.ok) return { ok: true };
  return { ok: false, erreur: r?.erreur ?? "L'invitation n'a pas pu être envoyée." };
}

/**
 * Retire un membre du foyer.
 *
 * RLS refuse silencieusement : une suppression interdite ne lève pas d'erreur,
 * elle rend simplement zéro ligne. Il faut donc demander le compte, sans quoi
 * un refus passerait pour un succès.
 */
export async function retirerMembre(id: string): Promise<{ ok: boolean; erreur?: string }> {
  const { data, error } = await supabase
    .from('household_members')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('[retirerMembre]', error);
    return { ok: false, erreur: 'Impossible de retirer ce membre.' };
  }
  if (!data || data.length === 0) {
    return { ok: false, erreur: 'Tu ne peux pas retirer ce membre.' };
  }
  return { ok: true };
}

/** Renomme le foyer. Un nom vide est refusé. */
export async function renommerFoyer(
  id: string,
  nom: string,
): Promise<{ ok: boolean; erreur?: string }> {
  const propre = nom.trim();
  if (!propre) return { ok: false, erreur: 'Donne un nom à ton foyer.' };

  const { error } = await supabase.from('households').update({ name: propre }).eq('id', id);
  if (error) {
    console.error('[renommerFoyer]', error);
    return { ok: false, erreur: 'Impossible de renommer le foyer.' };
  }
  return { ok: true };
}
