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
  progresser, terminer, equivalencesDe, enregistrerEquivalence, enregistrerOffres,
  recherchesAFaire, majRecherche, signalerPresence, enregistrerFiche,
} from './supabase.js';
import { fileDeRecherches, pauseEntreRecherches, adresseRecherche, issueRecherche, drivesAuto } from './lib/recherches.js';
import { strategie, indexer } from './lib/equivalences.js';
import { offresDepuisReleve } from './lib/offres.js';
import { candidats, RAISONS_SUIVANT } from './lib/alternatives.js';
import { attenteAvantNavigation, ENTRE_PRODUITS_MS, LECTURE_MS } from './lib/rythme.js';

/**
 * Période de sondage.
 *
 * Un service worker Manifest V3 est terminé après une trentaine de secondes
 * d'inactivité : il ne peut pas tenir un abonnement temps réel. `chrome.alarms`
 * est la voie native. Pour une commande mensuelle, une minute de latence ne se
 * voit pas.
 */
// Trente secondes, le minimum de chrome.alarms : une recherche demandée depuis
// l'iPhone part ainsi en moins d'une demi-minute quand Chrome est ouvert.
const PERIODE_MINUTES = 0.5;

function armerAlarme() {
  chrome.alarms.create('travaux', { periodInMinutes: PERIODE_MINUTES });
}
chrome.runtime.onInstalled.addListener(armerAlarme);
chrome.runtime.onStartup.addListener(armerAlarme);

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'travaux') { rafraichirPastille(); signaler(true); essayerDemarrageAuto(); }
});

// --- Présence : l'app voit si l'ordinateur est là et ce qui avance ---

/**
 * Ce qui tourne vraiment, en mémoire du service worker. L'état rangé dans
 * chrome.storage survit à un arrêt du worker : un « running » qui y traîne
 * n'est donc pas la preuve qu'un remplissage avance, et ne doit rien bloquer.
 */
const enMarche = { remplissage: false, recherches: false };
let dernierSignal = 0;

/** L'activité à annoncer, d'après ce qui tourne et ce qui attend une main. */
async function activiteCourante() {
  const job = await getState(), rech = await etatRecherches();
  if (enMarche.recherches && rech) {
    return ['recherches', { fait: rech.fait ?? 0, total: rech.total ?? 0, drive: rech.drive ?? null, requete: rech.requete ?? null }];
  }
  if (enMarche.remplissage && job) {
    return ['remplissage', { fait: job.cursor ?? 0, total: job.items?.length ?? 0, drive: job.site ?? null }];
  }
  if (job?.status === 'paused') return ['pause', { message: `Vérification demandée sur ${SITES[job.site]?.label ?? 'le drive'}.` }];
  if (rech?.statut === 'pause' && rech.message && rech.cause !== 'erreur') return ['pause', { message: rech.message }];
  return ['prete', { auto: await rechercheAuto() }];
}

/** Envoie la présence ; au plus toutes les 4 secondes, sauf changement d'étape (force). */
async function signaler(force = false) {
  if (!force && Date.now() - dernierSignal < 4000) return;
  dernierSignal = Date.now();
  const [activite, detail] = await activiteCourante();
  try { await signalerPresence(activite, detail, chrome.runtime.getManifest().version); } catch { /* l'app ne verra rien, sans conséquence ici */ }
}

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
  let n = premier ? (premier.items?.length ?? 0) : 0;
  // Sans liste à remplir, la pastille compte les recherches demandées.
  if (!n) {
    const rech = await recherchesAFaire();
    n = rech.ok ? (rech.data?.length ?? 0) : 0;
    // Des recherches arrivent de l'iPhone : on le dit une fois, sans rien lancer.
    const { recherches_annoncees: avant = 0 } = await chrome.storage.local.get('recherches_annoncees');
    if (n > avant && !enMarche.recherches && !(await rechercheAuto())) {
      chrome.notifications.create('recherches', { type: 'basic', iconUrl: 'icon-128.png', title: 'Recherches demandées',
        message: `${n} recherche${n > 1 ? 's' : ''} depuis l'application. Ouvre l'extension et clique sur « Lancer les recherches ».` });
    }
    await chrome.storage.local.set({ recherches_annoncees: n });
  }
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
const DELAY_BETWEEN_ITEMS_MS = ENTRE_PRODUITS_MS;

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
  signaler(patch.status !== undefined);
  return next;
}

let derniereNavigation = 0;

/**
 * Charge une page dans l'onglet en respectant le rythme : jamais deux
 * chargements à moins de INTERVALLE_NAVIGATION_MS, puis un temps de lecture.
 */
async function naviguer(tabId, url) {
  await sleep(attenteAvantNavigation(derniereNavigation, Date.now()));
  derniereNavigation = Date.now();
  await chrome.tabs.update(tabId, { url });
  await waitForTab(tabId);
  await sleep(LECTURE_MS);
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
    const retenu = answers.find((a) => a.ok) ?? answers.find((a) => a.reason !== 'no_results') ?? answers[0];
    // Quand aucun cadre n'aboutit, ce que chacun a vu, pour comprendre un drive muet.
    return retenu.ok ? retenu : { ...retenu, cadres: answers.map(resumeCadre) };
  } catch (e) {
    return { ok: false, reason: 'inject_failed', message: String(e).slice(0, 200) };
  }
}

/** Ce qu'un cadre a vu, en peu d'octets : de quoi expliquer un « rien trouvé ». */
function resumeCadre(a) {
  const d = a.diagnostic ?? {};
  return {
    raison: a.reason ?? null,
    url: String(d.url ?? '').slice(0, 160),
    titre: String(d.title ?? '').slice(0, 80),
    etat: d.state ?? null,
    cartes: d.cardSelectors ?? null,
    iframes: d.exploration?.iframes ?? null,
    elements: d.exploration?.elements ?? null,
    classes: d.exploration?.classesProbables?.slice(0, 6) ?? null,
  };
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
    await naviguer(tabId, voie.valeur);
    const r = await runAgent(tabId, cfg, item, 'run');
    if (r.ok) return { ...r, via: 'equivalence_url' };
    // La fiche mémorisée ne répond plus : on retombe sur la voie normale.
  }
  if (voie.voie === 'label') {
    // Seule voie déterministe chez Leclerc, dont les liens produit n'ont pas
    // d'adresse lisible.
    await naviguer(tabId, searchUrl);
    const r = await runAgent(tabId, cfg, { ...item, exactLabel: voie.valeur }, 'run');
    if (r.ok) return { ...r, searchUrl, via: 'equivalence_label' };
  }

  const directUrl =
    item.url ||
    (item.ean && cfg.productUrlTemplate
      ? cfg.productUrlTemplate.replace('{ean}', item.ean)
      : null);

  if (directUrl) {
    await naviguer(tabId, directUrl);
    const direct = await runAgent(tabId, cfg, item, 'run');
    if (direct.ok) return { ...direct, via: direct.via ?? 'direct_url' };
    if (!RETRYABLE_VIA_SEARCH.has(direct.reason)) return direct;
    // Sinon : le produit n'est pas accessible par sa fiche, on tente le nom.
  }

  await naviguer(tabId, searchUrl);
  const found = await runAgent(tabId, cfg, item, 'run');
  // searchUrl est conservée pour pouvoir revenir sur cette page et y choisir
  // un candidat après coup, sans relancer toute la liste.
  const enriched = { ...found, searchUrl };
  return directUrl && !found.ok ? { ...enriched, triedDirect: true } : enriched;
}

/**
 * Enregistre les offres d'une recherche. Un échec ne doit jamais bloquer le
 * remplissage du panier : le relevé est un bonus, pas une étape.
 */
async function releverOffres(releve, contexte) {
  const lignes = offresDepuisReleve(releve, contexte);
  if (!lignes.length) return null;
  try { await enregistrerOffres(lignes); } catch { /* relevé perdu, panier intact */ }
  // L'offre mise au panier : son prix part aussi dans le compte rendu.
  return lignes.find((l) => l.choisi) ?? null;
}

/** Boucle principale : déroule la liste jusqu'au bout, une pause, ou un arrêt. */
async function processJob() {
  if (enMarche.remplissage) return;
  enMarche.remplissage = true;
  try { await deroulerJob(); } finally { enMarche.remplissage = false; await signaler(true); }
}

async function deroulerJob() {
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
        await naviguer(tabId, cfgSuivant.origin);
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
    // La référence, puis ses alternatives dans l'ordre, sans les marques
    // distributeur d'une autre enseigne ; on s'arrête au premier trouvé.
    const essais = candidats(item, state.site);
    let result = { ok: false, reason: 'product_unavailable', autreEnseigne: true };
    let retenu = null;
    let choisie = null;
    for (const essai of essais) {
      result = await attempt(tabId, cfg, essai, state.baseOrigin, state.equivalences ?? {});
      retenu = essai;
      // Les offres vues pendant cette recherche alimentent le comparatif ;
      // elles ne font pas partie du compte rendu envoyé au téléphone.
      if (result.releve) {
        if (state.jobId) choisie = await releverOffres(result.releve, { drive: state.site, recherche: essai.name, productId: essai.product_id ?? null, jobId: state.jobId, choisi: result.ok ? result.label : null });
        const { releve: _releve, ...sansReleve } = result;
        result = sansReleve;
      }
      if (result.ok || !RAISONS_SUIVANT.has(result.reason)) break;
      if (!result.memorise && state.jobId && essai.product_id) {
        // L'absence apprise évite de réessayer ce produit à la prochaine commande.
        await enregistrerEquivalence({ product_id: essai.product_id, drive: state.site, search_query: essai.name, unavailable: true });
      }
      result = { ...result, memorise: true };
    }
    const entry = {
      item: item.name,
      quantity: retenu?.quantity ?? item.quantity,
      ...result,
      // Dit au téléphone qu'une alternative a pris le relais de la référence.
      ...(result.ok && retenu?.remplace ? { remplacePar: retenu.name } : {}),
      // Le produit et son prix au panier : le téléphone compare la commande
      // avec les précédentes, et les drives entre eux.
      ...(result.ok ? { product_id: retenu?.product_id ?? item.product_id ?? null, prix: choisie?.prix ?? null, ean: choisie?.ean13 ?? result.ean ?? null } : {}),
    };

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
  await naviguer(state.tabId, entry.searchUrl);

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
  // Le magasin du remplissage sert aussi aux recherches en arrière-plan.
  if (cfg.storePathPattern && baseOrigin && /\/magasin-/.test(baseOrigin)) {
    const { magasins = {} } = await chrome.storage.local.get('magasins');
    await chrome.storage.local.set({ magasins: { ...magasins, [site]: baseOrigin } });
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
    // Référence et alternatives : l'ordre d'essai vient de l'application.
    enseigne: i.enseigne ?? null,
    grammage_g: i.grammage_g ?? null,
    volume_ml: i.volume_ml ?? null,
    alternatives: i.alternatives ?? [],
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

// --- Recherches demandées depuis l'app ---

const CLE_RECHERCHES = 'courses_recherches';

async function etatRecherches() {
  const s = await chrome.storage.local.get(CLE_RECHERCHES);
  return s[CLE_RECHERCHES] ?? null;
}

async function majEtatRecherches(patch) {
  const suite = { ...((await etatRecherches()) ?? {}), ...patch };
  await chrome.storage.local.set({ [CLE_RECHERCHES]: suite });
  chrome.runtime.sendMessage({ type: 'recherches', etat: suite }).catch(() => {});
  signaler(patch.statut !== undefined);
  return suite;
}

/** Le réglage « Lancer automatiquement les recherches demandées » (actif par défaut). */
async function rechercheAuto() {
  const { recherches_auto: auto = true } = await chrome.storage.local.get('recherches_auto');
  return auto !== false;
}

/**
 * Au passage de l'alarme : des recherches attendent et rien ne tourne, on les
 * lance sans clic, dans un onglet d'arrière-plan. Jamais après une pause qui
 * attend une main (vérification, magasin, pause demandée).
 */
async function essayerDemarrageAuto() {
  if (enMarche.recherches || enMarche.remplissage) return;
  const r = await recherchesAFaire();
  if (!r.ok) return;
  const drives = drivesAuto({ auto: await rechercheAuto(), recherches: r.data ?? [], occupe: false, etat: await etatRecherches() });
  if (!drives.length) return;
  try { await lancerRecherches({ auto: true, drives }); } catch { /* relancé à la prochaine alarme */ }
}

/**
 * L'onglet où chercher sur ce drive. À la main : un onglet déjà ouvert sur le
 * site, où l'utilisateur est connecté et a choisi son magasin, sinon un
 * nouveau. En automatique : un onglet à part, en arrière-plan, pour ne jamais
 * détourner celui où l'on navigue. Chez E.Leclerc, sans magasin dans
 * l'adresse, la recherche ne vise rien.
 */
/**
 * L'adresse du magasin choisi sur ce drive (E.Leclerc la porte dans son
 * chemin) : relevée sur tout onglet ouvert du drive et retenue, pour que
 * l'onglet d'arrière-plan aille droit au bon magasin.
 */
async function magasinConnu(cfg, site) {
  if (!cfg.storePathPattern) return cfg.origin;
  const { magasins = {} } = await chrome.storage.local.get('magasins');
  const onglets = await chrome.tabs.query({});
  for (const t of onglets) {
    try {
      const u = new URL(t.url);
      const segment = cfg.hostPattern.test(u.hostname) ? u.pathname.match(cfg.storePathPattern)?.[0] : null;
      if (segment) { magasins[site] = u.origin + segment; await chrome.storage.local.set({ magasins }); break; }
    } catch { /* onglet sans adresse lisible */ }
  }
  // Une adresse retenue par la 1.4.1 peut encore porter « .aspx ».
  return magasins[site]?.replace(/\.aspx$/i, '') ?? null;
}

async function ongletDuDrive(cfg, { auto = false, site = null } = {}) {
  let tab = null;
  if (auto) {
    const depart = (await magasinConnu(cfg, site)) ?? cfg.origin;
    const { onglet_auto: id } = await chrome.storage.local.get('onglet_auto');
    if (id) {
      try { tab = await chrome.tabs.get(id); await naviguer(id, depart); tab = await chrome.tabs.get(id); } catch { tab = null; }
    }
    if (!tab) {
      tab = await chrome.tabs.create({ url: depart, active: false });
      await chrome.storage.local.set({ onglet_auto: tab.id });
      await waitForTab(tab.id);
      tab = await chrome.tabs.get(tab.id);
    }
  } else {
    const onglets = await chrome.tabs.query({});
    tab = onglets.find((t) => { try { return Boolean(t.url) && cfg.hostPattern.test(new URL(t.url).hostname); } catch { return false; } });
    if (!tab) {
      tab = await chrome.tabs.create({ url: cfg.origin, active: true });
      await waitForTab(tab.id);
      tab = await chrome.tabs.get(tab.id);
    }
  }
  let baseOrigin = null;
  try {
    const u = new URL(tab.url);
    const segment = cfg.storePathPattern ? (u.pathname.match(cfg.storePathPattern)?.[0] ?? '') : '';
    baseOrigin = cfg.storePathPattern && !segment ? null : u.origin + segment;
  } catch { baseOrigin = null; }
  // Le magasin vu ici est retenu pour les prochaines fois.
  if (cfg.storePathPattern && baseOrigin && site) {
    const { magasins = {} } = await chrome.storage.local.get('magasins');
    if (magasins[site] !== baseOrigin) await chrome.storage.local.set({ magasins: { ...magasins, [site]: baseOrigin } });
  }
  return { tabId: tab.id, baseOrigin };
}

/**
 * Lance les recherches en attente : sur clic dans le popup, ou seul quand le
 * réglage automatique est actif. Une recherche interrompue par une
 * vérification est refaite au lancement suivant.
 */
async function lancerRecherches({ auto = false, drives = null } = {}) {
  if (enMarche.recherches) throw new Error('Recherches déjà en cours');
  if (enMarche.remplissage) throw new Error('Un remplissage de panier est en cours, attends sa fin');
  const r = await recherchesAFaire();
  if (!r.ok) throw new Error(r.deconnecte ? 'Session expirée, reconnecte-toi' : 'Base injoignable, réessaie');
  // En automatique, seuls les drives qui n'attendent pas une main.
  const file = fileDeRecherches(r.data).filter((g) => !drives || drives.includes(g.drive));
  const total = file.reduce((n, g) => n + g.recherches.length, 0);
  if (!total) return { total: 0 };
  await majEtatRecherches({ statut: 'en_cours', total, fait: 0, journal: [], drive: file[0].drive, requete: null, message: null, cause: null, auto });
  enMarche.recherches = true;
  if (auto) {
    chrome.notifications.create('recherches', { type: 'basic', iconUrl: 'icon-128.png', title: 'Recherches lancées',
      message: `${total} recherche${total > 1 ? 's' : ''} demandée${total > 1 ? 's' : ''} depuis l'application, dans un onglet en arrière-plan.` });
  }
  faireRecherches(file, { auto })
    .catch(async (e) => { await majEtatRecherches({ statut: 'pause', cause: 'erreur', message: `Les recherches se sont arrêtées : ${String(e).slice(0, 120)}. Elles reprendront seules.` }); })
    .finally(async () => { enMarche.recherches = false; await signaler(true); });
  return { total };
}

async function pauseRecherches() {
  await majEtatRecherches({ statut: 'pause', cause: 'manuel', message: 'En pause. Relance pour continuer.' });
  return { ok: true };
}

async function faireRecherches(file, { auto = false } = {}) {
  let fait = 0;
  for (const groupe of file) {
    const cfg = SITES[groupe.drive];
    const { tabId, baseOrigin } = await ongletDuDrive(cfg, { auto, site: groupe.drive });
    if (cfg.storePathPattern && !baseOrigin) {
      if (auto) await chrome.tabs.update(tabId, { active: true }).catch(() => {});
      await majEtatRecherches({ statut: 'pause', cause: 'magasin', driveBloque: groupe.drive, message: `Choisis ton magasin ${cfg.label} dans l'onglet, puis relance.` });
      return;
    }
    await majEtatRecherches({ drive: groupe.drive });
    for (const rech of groupe.recherches) {
      const etat = await etatRecherches();
      if (etat?.statut !== 'en_cours') return;
      await majRecherche(rech.id, { statut: 'en_cours' });
      await majEtatRecherches({ requete: rech.requete });
      // Une fiche à lire pour le comparatif : on l'ouvre, on en garde le texte utile, sans rien cliquer.
      if (rech.type === 'fiche') {
        let compteFiche = { ok: false, reason: 'no_results' };
        if (rech.url) { await naviguer(tabId, rech.url); compteFiche = await runAgent(tabId, cfg, { name: rech.requete, quantity: 1 }, 'fiche'); }
        const lue = compteFiche.ok && rech.offre_id ? (await enregistrerFiche(rech.offre_id, compteFiche.texte)).ok : false;
        const statutFiche = compteFiche.reason === 'challenge' ? 'verification' : lue ? 'faite' : 'vide';
        await majRecherche(rech.id, { statut: statutFiche, resultats: lue ? 1 : 0, faite_le: statutFiche === 'verification' ? null : new Date().toISOString() });
        if (statutFiche === 'verification') {
          if (auto) await chrome.tabs.update(tabId, { active: true }).catch(() => {});
          await majEtatRecherches({ statut: 'pause', cause: 'verification', driveBloque: groupe.drive, message: `Vérification demandée sur ${cfg.label}. Résous-la dans l'onglet, puis relance.` });
          return;
        }
        fait += 1;
        await majEtatRecherches({ fait, journal: [...(etat.journal ?? []), { requete: `fiche · ${rech.requete}`, drive: groupe.drive, statut: statutFiche, n: lue ? 1 : 0 }].slice(-30) });
        await sleep(pauseEntreRecherches());
        continue;
      }
      const item = { name: rech.requete, quantity: 1, ean: rech.ean13 ?? null };
      let compte = { ok: false, reason: 'no_results' };
      // Un code-barres ouvre la fiche Carrefour sans recherche ni ambiguïté.
      if (rech.ean13 && cfg.productUrlTemplate) {
        await naviguer(tabId, cfg.productUrlTemplate.replace('{ean}', rech.ean13));
        compte = await runAgent(tabId, cfg, item, 'releve');
      }
      if (!compte.ok && compte.reason !== 'challenge') {
        await naviguer(tabId, adresseRecherche(cfg, baseOrigin, rech.requete));
        compte = await runAgent(tabId, cfg, item, 'releve');
      }
      let lignes = compte.ok ? offresDepuisReleve(compte.releve, { drive: groupe.drive, recherche: rech.requete, rechercheId: rech.id }) : [];
      if (lignes.length && !(await enregistrerOffres(lignes)).ok) lignes = [];
      const statut = issueRecherche(compte, lignes.length);
      await majRecherche(rech.id, {
        statut, resultats: lignes.length, faite_le: statut === 'verification' ? null : new Date().toISOString(),
        diagnostic: lignes.length
          ? { echantillon: (compte.releve ?? []).slice(0, 8).map((c) => ({ label: c.label, prix: c.prix, image: Boolean(c.image), href: String(c.href ?? '').slice(0, 120), cls: c.cls, texte: String(c.texte ?? '').slice(0, 300), html: c.html })) }
          : { raison: compte.reason ?? null, message: String(compte.message ?? '').slice(0, 200), cadres: compte.cadres ?? null },
      });
      if (statut === 'verification') {
        // L'onglet d'arrière-plan passe devant : c'est là que la vérification se résout.
        if (auto) await chrome.tabs.update(tabId, { active: true }).catch(() => {});
        await majEtatRecherches({ statut: 'pause', cause: 'verification', driveBloque: groupe.drive, message: `Vérification demandée sur ${cfg.label}. Résous-la dans l'onglet, puis relance.` });
        chrome.notifications.create({ type: 'basic', iconUrl: 'icon-128.png', title: 'Vérification demandée',
          message: `${cfg.label} demande une vérification. Résous-la dans l'onglet, puis relance les recherches.` });
        return;
      }
      fait += 1;
      const journal = [...(etat.journal ?? []), { requete: rech.requete, drive: groupe.drive, statut, n: lignes.length }].slice(-30);
      await majEtatRecherches({ fait, journal });
      await sleep(pauseEntreRecherches());
    }
  }
  await majEtatRecherches({ statut: 'fini', message: null, cause: null });
  // L'onglet ouvert pour l'occasion se referme ; celui de l'utilisateur, jamais.
  if (auto) {
    const { onglet_auto: id } = await chrome.storage.local.get('onglet_auto');
    if (id) { await chrome.tabs.remove(id).catch(() => {}); await chrome.storage.local.remove('onglet_auto'); }
  }
  chrome.notifications.create({ type: 'basic', iconUrl: 'icon-128.png', title: 'Recherches terminées',
    message: `${fait} recherche${fait > 1 ? 's' : ''} faite${fait > 1 ? 's' : ''} : les résultats sont dans l'application.` });
  await rafraichirPastille();
}

/** Pour le popup : l'état de la séance et le nombre de recherches en attente. */
async function recherchesPourPopup() {
  const r = await recherchesAFaire();
  const etat = await etatRecherches();
  // Un « en cours » rangé par un worker arrêté depuis n'avance plus : on le montre en pause.
  const vrai = etat?.statut === 'en_cours' && !enMarche.recherches ? { ...etat, statut: 'pause', message: 'Les recherches ont été interrompues. Relance pour reprendre.' } : etat;
  await signaler(true);
  return { etat: vrai, aFaire: r.ok ? (r.data?.length ?? 0) : 0, auto: await rechercheAuto() };
}

async function reglerAuto(actif) {
  await chrome.storage.local.set({ recherches_auto: actif !== false });
  await signaler(true);
  if (actif !== false) essayerDemarrageAuto();
  return { auto: actif !== false };
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
    recherches: recherchesPourPopup,
    lancerRecherches: () => lancerRecherches(),
    pauseRecherches,
    reglerAuto: () => reglerAuto(msg.actif),
  };
  const handler = handlers[msg.type];
  if (!handler) return false;
  Promise.resolve(handler())
    .then((r) => sendResponse({ ok: true, data: r }))
    .catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true; // réponse asynchrone
});
