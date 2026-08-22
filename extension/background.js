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
import {
  travauxEnAttente, travauxAbandonnes, revendiquer,
  progresser, terminer, equivalencesDe, enregistrerEquivalence,
} from './supabase.js';
import { strategie, indexer } from './lib/equivalences.js';

/**
 * Période de sondage.
 *
 * Un service worker Manifest V3 est terminé après une trentaine de secondes
 * d'inactivité : il ne peut pas tenir un abonnement temps réel. `chrome.alarms`
 * est la voie native. Pour une commande mensuelle, une minute de latence ne se
 * voit pas.
 */
const PERIODE_MINUTES = 1;

function armerAlarme() {
  chrome.alarms.create('travaux', { periodInMinutes: PERIODE_MINUTES });
}
chrome.runtime.onInstalled.addListener(armerAlarme);
chrome.runtime.onStartup.addListener(armerAlarme);

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'travaux') rafraichirPastille();
});

/**
 * Allume la pastille quand une liste attend.
 *
 * Ne démarre jamais rien : une extension qui piloterait un site marchand sans
 * qu'on l'ait déclenchée serait une mauvaise surprise, et c'est contraire à ce
 * que le README promet depuis le début.
 */
async function rafraichirPastille() {
  const r = await travauxEnAttente();
  if (!r.ok) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  const premier = r.data?.[0];
  const n = premier ? (premier.items?.length ?? 0) : 0;
  await chrome.action.setBadgeText({ text: n > 0 ? String(n) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#2D6A4F' });
}

/** Travaux relevables : en attente, plus ceux abandonnés en cours de route. */
async function travauxRelevables() {
  const attente = await travauxEnAttente();
  if (!attente.ok) return { ok: false, deconnecte: attente.deconnecte === true };
  const abandonnes = await travauxAbandonnes();
  // Un travail revendiqué puis abandonné redevient disponible : sinon une
  // extension fermée en plein remplissage bloquerait la liste pour toujours.
  const liste = [...(attente.data ?? []), ...(abandonnes.ok ? abandonnes.data ?? [] : [])];
  return { ok: true, data: { enAttente: liste, total: liste.length } };
}

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
      // Sans ce détail, une exception dans le script injecté se résumait à
      // « page muette » — un cul-de-sac au diagnostic. C'est exactement ce qui
      // masquait la RegExp perdue à la sérialisation.
      const causes = frames
        .map((f) => f?.error?.message ?? (f?.result === undefined ? 'aucune valeur renvoyée' : null))
        .filter(Boolean);
      return {
        ok: false,
        reason: 'no_result',
        message: causes.length
          ? `Le script n'a rien renvoyé : ${causes.join(' · ')}`
          : 'Aucune réponse de la page',
        cadres: frames.length,
      };
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
async function attempt(tabId, cfg, item, baseOrigin, equivalences = {}) {
  // Un chemin relatif prime quand on connaît l'origine réelle : les drives
  // Leclerc vivent chacun sur le sous-domaine de leur magasin.
  const searchUrl =
    cfg.searchPath && baseOrigin
      ? baseOrigin + cfg.searchPath.replace('{q}', encodeURIComponent(item.name))
      : cfg.searchUrl.replace('{q}', encodeURIComponent(item.name));

  // Ce qui a été tranché lors d'une commande précédente prime sur toute
  // recherche : c'est ce qui rend les commandes suivantes déterministes.
  const voie = strategie(item.product_id ? equivalences[item.product_id] : null);

  if (voie.voie === 'absent') {
    // Inutile de chercher ce qu'on sait absent de cette enseigne.
    return { ok: false, reason: 'product_unavailable', memorise: true };
  }
  if (voie.voie === 'url') {
    await chrome.tabs.update(tabId, { url: voie.valeur });
    await waitForTab(tabId);
    const r = await runAgent(tabId, cfg, item, 'run');
    if (r.ok) return { ...r, via: 'equivalence_url' };
    // La fiche mémorisée ne répond plus : on retombe sur la voie normale.
  }
  if (voie.voie === 'label') {
    // Seule voie déterministe chez Leclerc, dont les liens produit n'ont pas
    // d'adresse lisible.
    await chrome.tabs.update(tabId, { url: searchUrl });
    await waitForTab(tabId);
    const r = await runAgent(tabId, cfg, { ...item, exactLabel: voie.valeur }, 'run');
    if (r.ok) return { ...r, searchUrl, via: 'equivalence_label' };
  }

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
  // searchUrl est conservée pour pouvoir revenir sur cette page et y choisir
  // un candidat après coup, sans relancer toute la liste.
  const enriched = { ...found, searchUrl };
  return directUrl && !found.ok ? { ...enriched, triedDirect: true } : enriched;
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
      const parDrive = { ...(state.resultatsParDrive ?? {}), [state.site]: state.results };
      const restants = state.drivesRestants ?? [];

      if (restants.length > 0) {
        const suivant = restants[0];
        const cfgSuivant = SITES[suivant];
        // On repart de l'origine de l'enseigne suivante. Si la session n'y est
        // pas ouverte ou le magasin pas choisi, l'agent le signalera dès le
        // premier produit et on s'arrêtera proprement en `needs_action`.
        await chrome.tabs.update(tabId, { url: cfgSuivant.origin });
        await waitForTab(tabId);
        const onglet = await chrome.tabs.get(tabId);
        let origineSuivante = null;
        try {
          const u = new URL(onglet.url);
          const segment = cfgSuivant.storePathPattern
            ? (u.pathname.match(cfgSuivant.storePathPattern)?.[0] ?? '')
            : '';
          origineSuivante = u.origin + segment;
        } catch {
          origineSuivante = null;
        }
        await setState({
          site: suivant,
          baseOrigin: origineSuivante,
          drivesRestants: restants.slice(1),
          resultatsParDrive: parDrive,
          equivalences: await chargerEquivalences(suivant),
          results: [],
          cursor: 0,
        });
        continue;
      }

      await setState({ status: 'done', finishedAt: Date.now(), resultatsParDrive: parDrive });
      if (state.jobId) await terminer(state.jobId, 'done', parDrive);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-128.png',
        title: 'Panier rempli',
        message: `${state.results.filter((r) => r.ok).length} produit(s) ajouté(s) sur ${cfg.label}.`,
      });
      await chrome.action.setBadgeText({ text: '' });
      return;
    }

    const item = state.items[index];
    let result = await attempt(tabId, cfg, item, state.baseOrigin, state.equivalences ?? {});
    const entry = { item: item.name, quantity: item.quantity, ...result };

    // Un challenge n'est pas un échec de produit : c'est une main à rendre.
    if (!result.ok && result.reason === 'challenge') {
      await setState({ status: 'paused', pauseReason: 'challenge' });
      if (state.jobId) {
        // `needs_action` et non `failed` : rien n'est cassé, il manque un geste
        // humain. Le téléphone peut alors le dire en clair, et ce qui a déjà
        // été mis au panier n'est pas perdu.
        await terminer(
          state.jobId, 'needs_action',
          { ...(state.resultatsParDrive ?? {}), [state.site]: state.results },
          `Vérification demandée sur ${cfg.label}.`,
        );
      }
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-128.png',
        title: 'Vérification demandée',
        message: 'Le site demande une vérification. Résous-la dans l\'onglet, puis reprends.',
      });
      return;
    }

    if (!result.ok && !result.memorise && state.jobId && item.product_id
        && ['no_match', 'product_unavailable'].includes(result.reason)) {
      // Enregistrer l'absence évite de la redécouvrir à chaque commande, et
      // alimentera le comparatif « produits manquants » prévu au brief.
      await enregistrerEquivalence({
        product_id: item.product_id,
        drive: state.site,
        search_query: item.name,
        unavailable: true,
      });
    }

    const results = [...(state.results ?? []), entry];
    await setState({ results, cursor: index + 1 });
    if (state.jobId) {
      // Le compte porte sur l'enseigne en cours, pas sur le total des deux :
      // une progression cumulée serait trompeuse une fois la première finie.
      await progresser(state.jobId, {
        drive: state.site,
        fait: index + 1,
        total: state.items.length,
      });
    }
    await sleep(DELAY_BETWEEN_ITEMS_MS);
  }
}

/**
 * Ajoute un candidat désigné par l'utilisateur après une ambiguïté.
 *
 * On revient sur la page de recherche d'origine et on cible le produit par son
 * libellé exact, sans repasser par le classement : c'est un choix humain, il
 * n'y a plus rien à évaluer.
 *
 * @param {number} index Rang de la ligne dans les résultats.
 * @param {string} label Libellé du candidat retenu.
 */
async function chooseCandidate(index, label) {
  const state = await getState();
  if (!state) throw new Error('Aucune liste en cours');
  if (state.status === 'running') throw new Error('Remplissage en cours, patiente');

  const entry = state.results?.[index];
  if (!entry?.searchUrl) throw new Error('Page de recherche inconnue pour cette ligne');

  const cfg = SITES[state.site];
  await chrome.tabs.update(state.tabId, { url: entry.searchUrl });
  await waitForTab(state.tabId);

  const item = { name: entry.item, quantity: entry.quantity, exactLabel: label };
  const result = await runAgent(state.tabId, cfg, item, 'run');

  const results = [...state.results];
  results[index] = { ...entry, ...result, chosen: true, candidates: null };
  await setState({ results });

  const ligne = state.items?.[index];
  if (result.ok && state.jobId && ligne?.product_id) {
    // Une ambiguïté tranchée une fois ne se repose plus : c'est tout l'intérêt
    // du mécanisme d'équivalences.
    await enregistrerEquivalence({
      product_id: ligne.product_id,
      drive: state.site,
      search_query: ligne.name,
      matched_label: label,
      // Surtout pas l'adresse rendue par l'agent : après une recherche, c'est
      // la page de RÉSULTATS, pas la fiche. L'enregistrer comme fiche ferait
      // revenir l'extension sur une page de recherche à chaque commande, en
      // croyant aller droit au produit. Le libellé exact suffit, et c'est de
      // toute façon la seule voie chez Leclerc.
      product_url: null,
      ean13: ligne.ean ?? null,
      unavailable: false,
    });
  }

  return result;
}

/** Démarre un travail de remplissage. */
async function startJob({ site, items }, supplement = {}) {
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
    // Champs du pont Supabase : absents lors d'une saisie manuelle.
    jobId: null,
    drivesRestants: [],
    resultatsParDrive: {},
    equivalences: {},
    ...supplement,
  });

  processJob();
  return { ok: true, count: items.length };
}

/**
 * Démarre le remplissage à partir d'un travail relevé dans `cart_jobs`.
 *
 * Les articles y sont écrits par le wizard sous la forme `{name, quantity,
 * unit, ean13, category, product_id}` ; l'orchestrateur attend `ean` et non
 * `ean13`. La conversion est faite ici, en un seul endroit.
 */
async function demarrerTravail(jobId) {
  const relevables = await travauxRelevables();
  if (!relevables.ok) throw new Error('Session expirée, reconnecte-toi');
  const travail = relevables.data.enAttente.find((t) => t.id === jobId);
  if (!travail) throw new Error('Ce travail n\'est plus disponible');

  const drives = travail.drives ?? [];
  if (!drives.length) throw new Error('Aucune enseigne indiquée');

  const items = (travail.items ?? []).map((i) => ({
    name: i.name,
    quantity: i.quantity,
    ean: i.ean13 ?? null,
    product_id: i.product_id ?? null,
  }));

  await revendiquer(jobId);
  const equivalences = await chargerEquivalences(drives[0]);

  return startJob({ site: drives[0], items }, {
    jobId,
    drivesRestants: drives.slice(1),
    resultatsParDrive: {},
    equivalences,
  });
}

/** Charge et indexe les équivalences mémorisées pour une enseigne. */
async function chargerEquivalences(drive) {
  const eq = await equivalencesDe(drive);
  // `chrome.storage` ne sait pas sérialiser une Map : on range un objet.
  return Object.fromEntries(indexer(eq.ok ? eq.data : []));
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
    choose: () => chooseCandidate(msg.index, msg.label),
    diagnose: () => diagnose(msg.site),
    travaux: travauxRelevables,
    demarrerTravail: () => demarrerTravail(msg.jobId),
  };
  const handler = handlers[msg.type];
  if (!handler) return false;
  Promise.resolve(handler())
    .then((r) => sendResponse({ ok: true, data: r }))
    .catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true; // réponse asynchrone
});
