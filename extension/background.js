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
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: pageAgent,
      args: [cfg, item, mode],
      // Monde isolé (défaut) : accès complet au DOM sans partager le contexte
      // JS de la page, donc aucun risque de collision avec son framework.
    });
    return result?.result ?? { ok: false, reason: 'no_result', message: 'Aucune réponse de la page' };
  } catch (e) {
    return { ok: false, reason: 'inject_failed', message: String(e).slice(0, 200) };
  }
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
    const url = cfg.searchUrl.replace('{q}', encodeURIComponent(item.name));

    await chrome.tabs.update(tabId, { url });
    await waitForTab(tabId);

    const result = await runAgent(tabId, cfg, item, 'run');
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

  const tab = await chrome.tabs.create({ url: cfg.origin, active: true });
  await waitForTab(tab.id);

  await setState({
    site,
    items,
    tabId: tab.id,
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
