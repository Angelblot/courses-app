/**
 * Logique de session, sans accès au réseau ni au stockage.
 *
 * Séparée de `supabase.js` pour rester exécutable sous `node --test` : un
 * module qui importe `chrome.*` ne l'est pas.
 */

/** Marge avant expiration : on renouvelle d'avance, jamais au dernier moment. */
const MARGE_MS = 60_000;

/**
 * Dit si une session doit être renouvelée avant d'être utilisée.
 *
 * La marge évite qu'un jeton expire entre la vérification et l'arrivée de la
 * requête au serveur — la panne serait alors intermittente et incompréhensible.
 */
export function estExpire(session, maintenantMs) {
  if (!session?.expire_le) return true;
  return session.expire_le - MARGE_MS <= maintenantMs;
}

/** En-têtes d'un appel authentifié à Supabase. */
export function entetes(session, cleApi) {
  return {
    apikey: cleApi,
    Authorization: `Bearer ${session?.jeton ?? ''}`,
    'Content-Type': 'application/json',
  };
}
