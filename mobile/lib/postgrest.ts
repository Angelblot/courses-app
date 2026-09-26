/**
 * Détection de panne réseau dans une erreur postgrest-js.
 *
 * Extrait de `stores/products.ts` pour être exportée et testée : c'est le
 * pivot de toute la file d'attente hors connexion (voir `lib/queue.ts` et
 * `app/(tabs)/scan.tsx`), et son fonctionnement dépend d'un détail interne
 * d'une librairie tierce plutôt que d'un contrat documenté.
 */

/** Sous-ensemble d'une erreur postgrest-js pertinent pour ce diagnostic. */
export type ErreurPostgrest = { code?: string };

/**
 * Une erreur postgrest-js sans `code` vient d'un `fetch` qui a levé une
 * exception avant qu'une réponse HTTP n'arrive — coupure réseau, DNS,
 * timeout (voir `node_modules/@supabase/postgrest-js/dist/index.cjs`, le
 * bloc `res.catch((fetchError) => ...)` dans `PostgrestBuilder.prototype.then` :
 * il construit toujours `code: ''`, y compris pour un abandon ou un
 * dépassement d'en-têtes). Une erreur qui a atteint PostgREST — violation
 * RLS, contrainte, colonne manquante — porte au contraire un code
 * Postgres/PostgREST non vide (ex. '23505', '42501', 'PGRST116'), posé par
 * `processResponse` en parsant le corps JSON renvoyé par le serveur. Un
 * code vide est donc un signal fiable — et propre à cette version de la
 * librairie — d'échec réseau plutôt que d'échec métier.
 *
 * Ce contrat n'est pas garanti par le SemVer de postgrest-js : une montée de
 * version qui remplirait `code` transformerait chaque coupure réseau en
 * échec définitif et ferait perdre les scans en attente (voir les tests de
 * `lib/postgrest.test.mjs`, qui figent ce comportement dans les deux sens).
 */
export function estErreurReseau(error: ErreurPostgrest): boolean {
  return !error.code;
}
