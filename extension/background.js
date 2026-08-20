/**
 * Orchestrateur du remplissage de panier.
 *
 * Il vit dans le service worker et non dans la page : chaque navigation détruit
 * les scripts injectés, seul un pilote extérieur peut donc enchaîner les
 * produits. Pour chaque ligne : naviguer vers la recherche, attendre le
 * chargement, injecter l'agent, enregistrer le résultat, passer au suivant.
 *
 * L'extension n'ouvre jamais de session : elle travaille dans l'onglet de
 * l'utilisateur, déjà connecté, qui a passé le contrôle humain normalement.
 * Rien n'est masqué ni falsifié — si une vérification apparaît, on s'arrête et
 * on rend la main.
 */

import { SITES } from './content/sites.js';
import { pageAgent } from './content/page-agent.js';

const STATE_KEY = 'courses_job';

/** Pause entre deux produits — rythme humain, pas de martèlement. */
const DELAY_BETWEEN_ITEMS_MS = 2500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getState() {
  const stored = await chrome.storage.local.get(STATE_KEY);
  return stored[STATE_KEY] ?? null;
}

async function setState(patch) {
  const current = (await getState()) ?? {};
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ [STATE_KEY]: next });
  // Le popup s'actualise s'il est ouvert ; sans lui l'erreur est sans effet.
  chrome.runtime.sendMessage({ type: 'state', state: next }).catch(() => {});
  return next;
}

/** Attend qu'un onglet ait fini de charger. */
function waitForTab(tabId, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const timer = setTimeout(finish, timeoutMs);
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') finish();
    }
    function finish() {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Exécute l'agent de page dans l'onglet et renvoie son compte rendu.
 *
 * @param {number} tabId Onglet cible.
 * @param {object} cfg Configuration de l'enseigne.
 * @param {object} item Ligne de courses.
 * @param {string} mode 'run' ou 'diagnose'.
 */
async function runAgent(tabId, cfg, item, mode) {
  try {
    const frames = await chrome.scripting.executeScript({
      // Tous les cadres : le drive Leclerc est un site ASP.NET dont les
      // résultats vivent dans une iframe. Se limiter au cadre principal y
      // donnait zéro élément pour absolument tous les sélecteurs.
      target: { tabId, allFrames: true },
      func: pageAgent,
      args: [cfg, item, mode],
      // Monde isolé (défaut) : accès complet au DOM sans partager le contexte
      // JS de la page, donc aucun risque de collision avec son framework.
    });

    const answers = frames
      .map((f) => (f?.result ? { ...f.result, frameId: f.frameId } : null))
      .filter(Boolean);

    if (!answers.length) {
      return { ok: false, reason: 'no_result', message: 'Aucune réponse de la page' };
    }

    if (mode === 'diagnose') {
      // Le cadre intéressant est celui qui a reconnu des cartes ; à défaut, le
      // plus fourni. On renvoie tout de même les autres, pour l'analyse.
      const withCards = answers.filter((a) => a.report?.cardSelectorUsed);
      const best =
        withCards[0] ??
        answers.reduce((a, b) =>
          (b.report?.exploration?.elements ?? 0) > (a.report?.exploration?.elements ?? 0) ? b : a
        );
      return { ...best, frames: answers.length };
    }

    // En exécution : un cadre a agi, les autres n'ont rien trouvé.
    return answers.find((a) => a.ok) ?? answers.find((a) => a.reason !== 'no_results') ?? answers[0];
  } catch (e) {
    return { ok: false, reason: 'inject_failed', message: String(e).slice(0, 200) };
  }
}

/** Motifs d'échec d'un accès direct qui justifient un repli sur la recherche. */
const RETRYABLE_VIA_SEARCH = new Set([
  'product_unavailable',
  'no_add_button',
  'click_no_effect',
  'wrong_product',
]);

/**
 * Traite une ligne : accès direct à la fiche si possible, repli sur la
 * recherche sinon.
 *
 * L'URL d'une fiche Carrefour n'a besoin que de l'EAN — son segment textuel est
 * décoratif. Connaissant le code-barres, on atteint donc le bon produit sans
 * recherche ni ambiguïté. Le repli couvre les produits absents de ce drive.
 *
 * @param {number} tabId Onglet piloté.
 * @param {object} cfg Configuration de l'enseigne.
 * @param {object} item Ligne de courses.
 * @returns {Promise<object>} Compte rendu, enrichi de la voie empruntée.
 */
async function attempt(tabId, cfg, item, baseOrigin) {
  // Un chemin relatif prime quand on connaît l'origine réelle : les drives
  // Leclerc vivent chacun sur le sous-domaine de leur magasin.
  const searchUrl =
    cfg.searchPath && baseOrigin
      ? baseOrigin + cfg.searchPath.replace('{q}', encodeURIComponent(item.name))
      : cfg.searchUrl.replace('{q}', encodeURIComponent(item.name));

  const directUrl =
    item.url ||
    (item.ean && cfg.productUrlTemplate
      ? cfg.productUrlTemplate.replace('{ean}', item.ean)
      : null);

  if (directUrl) {
    await chrome.tabs.update(tabId, { url: directUrl });
    await waitForTab(tabId);
    const direct = await runAgent(tabId, cfg, item, 'run');
    if (direct.ok) return { ...direct, via: direct.via ?? 'direct_url' };
    if (!RETRYABLE_VIA_SEARCH.has(direct.reason)) return direct;
    // Sinon : le produit n'est pas accessible par sa fiche, on tente le nom.
  }

  await chrome.tabs.update(tabId, { url: searchUrl });
  await waitForTab(tabId);
  const found = await runAgent(tabId, cfg, item, 'run');
  return directUrl && !found.ok ? { ...found, triedDirect: true } : found;
}

/** Boucle principale : déroule la liste jusqu'au bout, une pause, ou un arrêt. */
async function processJob() {
  let state = await getState();
  if (!state || state.status !== 'running') return;

  const cfg = SITES[state.site];
  const tabId = state.tabId;

  while (true) {
    state = await getState();
    if (!state || state.status !== 'running') return;

    const index = state.cursor;
    if (index >= state.items.length) {
      await setState({ status: 'done', finishedAt: Date.now() });
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-128.png',
        title: 'Panier rempli',
        message: `${state.results.filter((r) => r.ok).length} produit(s) ajouté(s) sur ${cfg.label}.`,
      });
      return;
    }

    const item = state.items[index];
    let result = await attempt(tabId, cfg, item, state.baseOrigin);
    const entry = { item: item.name, quantity: item.quantity, ...result };

    // Un challenge n'est pas un échec de produit : c'est une main à rendre.
    if (!result.ok && result.reason === 'challenge') {
      await setState({ status: 'paused', pauseReason: 'challenge' });
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-128.png',
        title: 'Vérification demandée',
        message: 'Le site demande une vérification. Résous-la dans l\'onglet, puis reprends.',
      });
      return;
    }

    const results = [...(state.results ?? []), entry];
    await setState({ results, cursor: index + 1 });
    await sleep(DELAY_BETWEEN_ITEMS_MS);
  }
}

/** Démarre un travail de remplissage. */
async function startJob({ site, items }) {
  const cfg = SITES[site];
  if (!cfg) throw new Error(`Enseigne inconnue : ${site}`);
  if (!Array.isArray(items) || !items.length) throw new Error('Liste vide');

  // Réutiliser l'onglet courant s'il est déjà sur le site de l'enseigne :
  // c'est le seul moyen de connaître le sous-domaine du magasin, et cela évite
  // de perdre la sélection de drive faite à la main.
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  let tab = active;
  let onSite = false;
  try {
    onSite = Boolean(active?.url) && cfg.hostPattern.test(new URL(active.url).hostname);
  } catch {
    onSite = false;
  }
  if (!onSite) {
    tab = await chrome.tabs.create({ url: cfg.origin, active: true });
    await waitForTab(tab.id);
    // Juste après création, tab.url n'est pas encore l'adresse chargée.
    tab = await chrome.tabs.get(tab.id);
  }

  let baseOrigin = null;
  try {
    const u = new URL(tab.url);
    // Le drive Leclerc préfixe ses chemins par le magasin
    // (/magasin-093401-…-Le-Cres-Montpellier) : sans ce segment, la recherche
    // ne pointe sur aucun magasin.
    const storeSegment = cfg.storePathPattern
      ? (u.pathname.match(cfg.storePathPattern)?.[0] ?? '')
      : '';
    baseOrigin = u.origin + storeSegment;
  } catch {
    baseOrigin = null;
  }

  await setState({
    site,
    items,
    tabId: tab.id,
    baseOrigin,
    cursor: 0,
    results: [],
    status: 'running',
    pauseReason: null,
    startedAt: Date.now(),
    finishedAt: null,
  });

  processJob();
  return { ok: true, count: items.length };
}

async function resumeJob() {
  await setState({ status: 'running', pauseReason: null });
  processJob();
  return { ok: true };
}

async function stopJob() {
  await setState({ status: 'stopped' });
  return { ok: true };
}

/** Mode diagnostic : décrit la page courante sans rien cliquer. */
async function diagnose(site) {
  const cfg = SITES[site];
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const result = await runAgent(tab.id, cfg, { name: 'diagnostic', quantity: 1 }, 'diagnose');
  return result;
}

// --- Messages venant du popup ---
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handlers = {
    start: () => startJob(msg.payload),
    resume: resumeJob,
    stop: stopJob,
    getState,
    diagnose: () => diagnose(msg.site),
  };
  const handler = handlers[msg.type];
  if (!handler) return false;
  Promise.resolve(handler())
    .then((r) => sendResponse({ ok: true, data: r }))
    .catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true; // réponse asynchrone
});

// --- Messages venant de l'application web (externally_connectable) ---
chrome.runtime.onMessageExternal.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'ping') {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return false;
  }
  if (msg?.type === 'start') {
    startJob(msg.payload)
      .then((r) => sendResponse({ ok: true, data: r }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  return false;
});
