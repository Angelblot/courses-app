/**
 * Client Supabase de l'extension, en appels REST directs.
 *
 * Pas de `@supabase/supabase-js` : l'extension n'a aucune chaîne de
 * compilation et s'installe en dossier non empaqueté. Y ajouter un paquet npm
 * imposerait un bundler et changerait la façon de l'installer.
 *
 * La clé publiable est publique par conception — RLS assure l'isolation des
 * données. Le jeton de session, lui, vit dans `chrome.storage.local`.
 */
import { estExpire, entetes } from './lib/session.js';

const URL_SB = 'https://qmymwicsgilhoihtfdjm.supabase.co';
const CLE = 'sb_publishable_PueJWmalqhZO0ctPu95GKQ_EaAgVulr';
const CLE_SESSION = 'courses_session';

async function lireSession() {
  const s = await chrome.storage.local.get(CLE_SESSION);
  return s[CLE_SESSION] ?? null;
}

async function ecrireSession(session) {
  await chrome.storage.local.set({ [CLE_SESSION]: session });
}

/** Convertit une réponse de jeton Supabase en session stockable. */
function versSession(data) {
  return {
    jeton: data.access_token,
    rafraichissement: data.refresh_token,
    expire_le: Date.now() + (data.expires_in ?? 3600) * 1000,
    email: data.user?.email ?? null,
  };
}

export async function connexion(email, motDePasse) {
  const r = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: CLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: motDePasse }),
  });
  if (!r.ok) {
    // Message français, jamais la réponse brute de Supabase.
    return { ok: false, erreur: 'E-mail ou mot de passe incorrect.' };
  }
  await ecrireSession(versSession(await r.json()));
  return { ok: true };
}

export async function deconnexion() {
  await chrome.storage.local.remove(CLE_SESSION);
}

export async function sessionCourante() {
  return lireSession();
}

/** Renvoie une session valide, en la renouvelant si besoin. */
async function sessionValide() {
  const session = await lireSession();
  if (!estExpire(session, Date.now())) return session;
  if (!session?.rafraichissement) return null;

  const r = await fetch(`${URL_SB}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: CLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.rafraichissement }),
  });
  if (!r.ok) {
    // Le jeton de rafraîchissement est mort : on efface plutôt que de
    // réessayer indéfiniment avec une session qui ne reviendra pas.
    await deconnexion();
    return null;
  }
  const suite = versSession(await r.json());
  await ecrireSession(suite);
  return suite;
}

async function appel(chemin, options = {}) {
  const session = await sessionValide();
  if (!session) return { ok: false, deconnecte: true };
  const r = await fetch(`${URL_SB}/rest/v1/${chemin}`, {
    ...options,
    headers: { ...entetes(session, CLE), ...(options.headers ?? {}) },
  });
  if (!r.ok) {
    console.error('[supabase]', chemin, r.status, await r.text());
    return { ok: false, statut: r.status };
  }
  const texte = await r.text();
  return { ok: true, data: texte ? JSON.parse(texte) : null };
}

/** Travaux en attente, du plus ancien au plus récent. */
export async function travauxEnAttente() {
  return appel('cart_jobs?status=eq.pending&select=*&order=created_at.asc');
}

/**
 * Travaux revendiqués mais abandonnés depuis plus de trente minutes.
 *
 * Sans cette reprise, une extension fermée en plein remplissage laisserait la
 * liste bloquée pour toujours, sans qu'aucun écran n'explique pourquoi.
 */
export async function travauxAbandonnes() {
  const limite = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  return appel(
    `cart_jobs?status=in.(claimed,running)&claimed_at=lt.${limite}&select=*&order=created_at.asc`,
  );
}

export async function revendiquer(id) {
  return appel(`cart_jobs?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'claimed', claimed_at: new Date().toISOString() }),
  });
}

export async function progresser(id, avancement) {
  return appel(`cart_jobs?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'running', progress: avancement }),
  });
}

export async function terminer(id, statut, resultats, erreur = null) {
  return appel(`cart_jobs?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: statut,
      results: resultats,
      error: erreur,
      finished_at: new Date().toISOString(),
    }),
  });
}

export async function equivalencesDe(drive) {
  return appel(`product_equivalents?drive=eq.${encodeURIComponent(drive)}&select=*`);
}

/**
 * Enregistre ou met à jour une équivalence.
 *
 * `resolution=merge-duplicates` s'appuie sur la contrainte unique
 * (user_id, product_id, drive) : une seconde résolution de la même ambiguïté
 * remplace la précédente au lieu d'échouer.
 */
export async function enregistrerEquivalence(entree) {
  return appel('product_equivalents', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ ...entree, last_confirmed_at: new Date().toISOString() }),
  });
}
