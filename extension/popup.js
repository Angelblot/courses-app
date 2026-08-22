/** Interface du popup : lancement, suivi, reprise après vérification. */

import { SITES } from './content/sites.js';
import { connexion, deconnexion, sessionCourante } from './supabase.js';

const $ = (id) => document.getElementById(id);

/**
 * Présélectionne l'enseigne d'après l'onglet actif.
 *
 * Sans cela, le menu reste sur Carrefour et un diagnostic lancé depuis une page
 * Leclerc teste les sélecteurs de la mauvaise enseigne : le rapport ne renvoie
 * que des zéros, sans que rien n'indique la cause.
 */
async function detectSite() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    const host = new URL(tab.url).hostname;
    for (const [key, cfg] of Object.entries(SITES)) {
      if (cfg.hostPattern?.test(host)) {
        $('site').value = key;
        $('site-hint').textContent = `Page ${cfg.label} détectée`;
        return;
      }
    }
    $('site-hint').textContent = "Aucune page de drive détectée dans l'onglet actif";
  } catch {
    // URL illisible (page interne de Chrome) : on garde la sélection par défaut.
  }
}

const send = (msg) =>
  new Promise((resolve) => chrome.runtime.sendMessage(msg, (r) => resolve(r)));

/**
 * Analyse la liste saisie à la main.
 *
 * Une ligne peut être :
 *   - un nom de produit, quantité optionnelle en suffixe « x2 » ;
 *   - une URL de fiche produit, qui court-circuite la recherche et donc toute
 *     ambiguïté entre produits aux noms voisins.
 *
 * @param {string} raw Texte brut du champ.
 * @returns {Array<{name: string, quantity: number, url?: string, ean?: string}>}
 */
function parseItems(raw) {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)\s*[x×]\s*(\d+)$/i);
      let body = m ? m[1].trim() : line;
      const quantity = m ? Number(m[2]) : 1;

      // Préfixe [EAN13] posé par l'application : identifiant certain du produit.
      let ean = null;
      const tagged = body.match(/^\[(\d{13})\]\s*(.*)$/);
      if (tagged) {
        ean = tagged[1];
        body = tagged[2].trim();
      }

      if (/^https?:\/\//i.test(body)) {
        // Le nom lisible est déduit du segment d'URL, l'EAN de son suffixe.
        const slug = body.split('/').filter(Boolean).pop() ?? body;
        const eanFromSlug = slug.match(/(\d{13})/)?.[1] ?? null;
        const name = slug
          .replace(/-?\d{13}.*$/, '')
          .replace(/-/g, ' ')
          .trim();
        return { name: name || body, quantity, url: body, ean: ean ?? eanFromSlug };
      }
      return ean ? { name: body, quantity, ean } : { name: body, quantity };
    });
}

const REASON_LABEL = {
  added: 'ajouté',
  no_match: 'aucun résultat convaincant',
  no_results: 'page non reconnue',
  no_add_button: "bouton d'ajout introuvable",
  ambiguous: 'plusieurs produits possibles — à choisir toi-même',
  click_no_effect: 'clic sans effet, rien ajouté',
  wrong_product: 'la fiche ouverte ne correspond pas',
  product_unavailable: 'produit non proposé par ce drive',
  challenge: 'vérification demandée',
  inject_failed: 'injection impossible',
  no_result: 'le script injecté n\'a rien renvoyé',
};

function render(state) {
  // Un travail en cours ou en pause masque la saisie ; terminé ou arrêté, on
  // affiche les deux — la liste reste consultable et on peut en relancer un.
  const active = state && ['running', 'paused'].includes(state.status);
  $('idle').hidden = Boolean(active);
  $('running').hidden = !state;

  if (!state) return;

  $('site-label').textContent = state.site === 'leclerc' ? 'E.Leclerc' : 'Carrefour';

  const total = state.items?.length ?? 0;
  const done = state.cursor ?? 0;
  const ok = (state.results ?? []).filter((r) => r.ok).length;

  $('bar').style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';

  const status =
    state.status === 'paused'
      ? 'En pause — vérification à résoudre dans l\'onglet, puis Reprendre.'
      : state.status === 'done'
        ? 'Terminé.'
        : state.status === 'stopped'
          ? 'Arrêté.'
          : 'En cours…';
  $('progress-text').textContent = `${done}/${total} traités · ${ok} ajoutés — ${status}`;

  $('resume').hidden = state.status !== 'paused';

  $('log').innerHTML = '';
  // L'index d'origine doit être conservé : le journal est affiché à l'envers
  // et tronqué, mais la reprise d'un candidat vise la ligne réelle.
  const entries = (state.results ?? []).map((r, index) => ({ r, index }));
  for (const { r, index } of entries.slice(-30).reverse()) {
    const li = document.createElement('li');
    li.className = r.ok ? 'log__item log__item--ok' : 'log__item log__item--ko';
    const certain = r.ok && (r.via === 'direct_url' || r.via === 'ean_match');
    const detail = r.ok
      ? r.label || ''
      : r.message || REASON_LABEL[r.reason] || r.reason || '';
    // Un produit approchant doit se voir : sinon on croit avoir eu ce qu'on
    // demandait alors qu'un terme a été écarté du rayon.
    const nuance = certain
      ? ' (par code-barres)'
      : r.ignored?.length
        ? ` (sans « ${r.ignored.join(' ')} »)`
        : '';
    li.textContent = `${r.item} — ${detail}${nuance}`;
    if (r.approximate) li.classList.add('log__item--approx');

    // Une ambiguïté sans propositions est un cul-de-sac : on liste les
    // candidats pour que le choix soit possible d'un coup d'œil.
    if (r.candidates?.length) {
      const ul = document.createElement('ul');
      ul.className = 'log__candidates';
      for (const c of r.candidates) {
        const label = c.label ?? c;
        const item = document.createElement('li');

        const texte = document.createElement('span');
        texte.textContent = label;
        item.appendChild(texte);

        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'log__choose';
        bouton.textContent = 'Choisir';
        // Pendant un remplissage, l'onglet est déjà piloté : deux actions
        // simultanées se disputeraient la même page.
        bouton.disabled = state.status === 'running';
        bouton.addEventListener('click', async () => {
          bouton.disabled = true;
          bouton.textContent = 'Ajout…';
          const res = await send({ type: 'choose', index, label });
          if (!res?.ok) {
            bouton.textContent = 'Échec';
            bouton.title = res?.error ?? '';
          }
        });
        item.appendChild(bouton);

        ul.appendChild(item);
      }
      li.appendChild(ul);
    }

    $('log').appendChild(li);
  }
}

const LIBELLE_DRIVE = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' };

/**
 * Affiche l'état du compte.
 *
 * La saisie manuelle reste visible dans tous les cas : elle ne dépend pas de
 * Supabase, et c'est le seul recours quand la session a expiré ou que le
 * service est injoignable.
 */
function rendreCompte(session) {
  const connecte = Boolean(session?.jeton);
  $('compte-connecte').hidden = !connecte;
  $('compte-formulaire').hidden = connecte;
  if (connecte) $('compte-email').textContent = session.email ?? 'Connecté';
}

function rendreTravaux(donnees) {
  const premier = donnees?.enAttente?.[0];
  if (!premier) {
    $('travaux').hidden = true;
    return;
  }
  $('travaux').hidden = false;
  const n = premier.items?.length ?? 0;
  const enseignes = (premier.drives ?? []).map((d) => LIBELLE_DRIVE[d] ?? d).join(' puis ');
  const suite = donnees.total > 1 ? ` · ${donnees.total - 1} autre(s) en attente` : '';
  $('travaux-resume').textContent =
    `${n} article${n > 1 ? 's' : ''} à mettre au panier — ${enseignes}${suite}`;
  $('remplir').dataset.jobId = premier.id;
}

async function relireCompte() {
  const session = await sessionCourante();
  rendreCompte(session);
  if (!session?.jeton) {
    $('travaux').hidden = true;
    return;
  }
  const res = await send({ type: 'travaux' });
  if (res?.deconnecte) {
    // Le jeton de rafraîchissement est mort : on le dit plutôt que de laisser
    // une pastille muette.
    $('compte-erreur').textContent = 'Session expirée, reconnecte-toi.';
    $('compte-erreur').hidden = false;
    rendreCompte(null);
    return;
  }
  if (res?.ok) rendreTravaux(res.data);
}

$('connexion').addEventListener('click', async () => {
  const email = $('email').value.trim();
  const mdp = $('mdp').value;
  if (!email || !mdp) {
    $('compte-erreur').textContent = 'Renseigne ton adresse et ton mot de passe.';
    $('compte-erreur').hidden = false;
    return;
  }
  $('compte-erreur').hidden = true;
  $('connexion').disabled = true;
  $('connexion').textContent = 'Connexion…';
  const res = await connexion(email, mdp);
  $('connexion').disabled = false;
  $('connexion').textContent = 'Se connecter';
  if (!res.ok) {
    $('compte-erreur').textContent = res.erreur;
    $('compte-erreur').hidden = false;
    return;
  }
  $('mdp').value = '';
  await relireCompte();
});

$('deconnexion').addEventListener('click', async () => {
  await deconnexion();
  await relireCompte();
});

$('remplir').addEventListener('click', async () => {
  const jobId = $('remplir').dataset.jobId;
  if (!jobId) return;
  $('remplir').disabled = true;
  const res = await send({ type: 'demarrerTravail', jobId });
  $('remplir').disabled = false;
  if (!res?.ok) {
    $('travaux-resume').textContent = `Échec : ${res?.error ?? 'inconnu'}`;
  }
});

$('start').addEventListener('click', async () => {
  const items = parseItems($('items').value);
  if (!items.length) return;
  const res = await send({
    type: 'start',
    payload: { site: $('site').value, items },
  });
  if (!res?.ok) $('progress-text').textContent = `Échec : ${res?.error ?? 'inconnu'}`;
});

$('diagnose').addEventListener('click', async () => {
  const res = await send({ type: 'diagnose', site: $('site').value });
  $('diag').hidden = false;
  $('diag').textContent = JSON.stringify(res?.data ?? res, null, 2);
});

$('resume').addEventListener('click', () => send({ type: 'resume' }));
$('stop').addEventListener('click', () => send({ type: 'stop' }));

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'state') render(msg.state);
});

detectSite();
relireCompte();
send({ type: 'getState' }).then((r) => render(r?.data ?? null));
