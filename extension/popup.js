/**
 * Le popup (maquette « L'extension Chrome, repensée ») : un écran par
 * situation — connexion, prête, en cours, en pause, terminée — et les outils
 * techniques rangés dans le menu « ⋮ ». Les échanges avec background.js sont
 * ceux d'avant : seule la présentation change.
 */

import { SITES } from './content/sites.js';
import { parseItems } from './lib/liste.js';
import { connexion, deconnexion, sessionCourante, enregistrerEquivalence, supprimerEquivalence, lireProduits, equivalencesDe } from './supabase.js';
import { produitsProches, chercherProduits } from './lib/fiche.js';

const $ = (id) => document.getElementById(id);
const send = (msg) => new Promise((resolve) => chrome.runtime.sendMessage(msg, (r) => resolve(r)));
const NOM = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' };
const nom = (d) => NOM[d] ?? d;
const plat = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
/** Environ, par produit : la page, la lecture, la pause à rythme humain. */
const SECONDES_PAR_PRODUIT = 14;
/** Un remplissage fini reste à l'écran jusqu'à « Terminer », ou une heure. */
const FINI_VISIBLE_MS = 60 * 60 * 1000;

const vue = { fiche: null, catalogue: [], equivalences: new Map(), choixFiche: null, rechercheFiche: '', ficheOk: null, pret: false, session: null, job: null, travaux: null, recherches: null, outil: null, finiVu: null, choisis: {}, erreurs: {}, arreter: false, annonce: '' };

// --- Petits constructeurs ---

function el(tag, attrs = {}, ...enfants) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const e of enfants.flat()) if (e != null) n.append(e);
  return n;
}
const icone = (nomIcone) => el('i', { class: `hgi-stroke hgi-${nomIcone}`, 'aria-hidden': 'true' });
function bouton(texte, { icon, clair, danger, onclick, disabled, cle } = {}) {
  return el('button', { class: `bouton${clair ? ' bouton--clair' : ''}${danger ? ' bouton--danger' : ''}`, onclick, disabled, 'data-cle': cle }, icon ? icone(icon) : null, el('span', { text: texte }));
}
function ligneDrive(d, texte, fait, total, ton = '') {
  const pct = total ? Math.round((fait / total) * 100) : 0;
  return el('div', { class: 'drive' },
    el('div', { class: 'drive__haut' }, el('span', { class: 'drive__nom', text: nom(d) }), el('span', { class: 'drive__etat', text: texte })),
    el('div', { class: 'barre', role: 'progressbar', 'aria-label': nom(d), 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' },
      el('div', { class: `barre__plein${ton ? ` barre__plein--${ton}` : ''}`, style: `width:${pct}%` })));
}

// --- Lecture de l'état du remplissage ---

/** Les drives du remplissage dans l'ordre, avec leurs lignes connues. */
function drivesDu(job) {
  if (!job) return [];
  const total = job.items?.length ?? 0;
  const faits = Object.entries(job.resultatsParDrive ?? {}).filter(([d]) => d !== job.site)
    .map(([d, lignes]) => ({ drive: d, lignes: lignes ?? [], total, fini: true }));
  const courant = { drive: job.site, lignes: job.results ?? [], total, fini: job.status === 'done', courant: true };
  const restants = (job.drivesRestants ?? []).map((d) => ({ drive: d, lignes: [], total, fini: false }));
  return [...faits, courant, ...restants];
}
const ajoutes = (lignes) => lignes.filter((l) => l.ok).length;

function detailLigne(r) {
  if (r.ok) {
    if (r.reason === 'already_in_cart') return `déjà au panier · × ${r.quantityInCart ?? r.quantity ?? 1}`;
    if (r.via === 'departage') return r.departage === 'format' ? 'ajouté · format de ta référence' : 'ajouté · même libellé';
    if (r.remplacePar) return `alternative : ${plat(r.remplacePar)}`;
    const q = r.quantityAdded ?? r.quantity ?? 1;
    return `ajouté${q > 1 ? ` · × ${q}` : ''}`;
  }
  return {
    ambiguous: 'plusieurs produits · à choisir',
    product_unavailable: r.autreEnseigne ? 'marque d’une autre enseigne · non vendu ici' : 'non vendu ici ou en rupture',
    no_add_button: 'en rupture',
    no_match: 'introuvable sous ce nom',
    no_results: 'introuvable sous ce nom',
    click_no_effect: 'le site a refusé l’ajout',
    wrong_product: 'la fiche ne correspond pas',
  }[r.reason] ?? 'non ajouté';
}
const puceDe = (r) => (r.ok ? ['ok', 'tick-02'] : r.reason === 'ambiguous' ? ['choix', 'alert-circle'] : ['ko', 'cancel-01']);

/** Le format d'un libellé, pour titrer une carte de choix : « 620 g », « x6 ». */
function formatDe(label) {
  const t = plat(label);
  const m = t.match(/(\d{1,3}\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*(?:kg|g|cl|ml|l)\b/i) ?? t.match(/[x×]\s?\d{1,3}\b/i);
  return m ? m[0].replace(/\s+/g, ' ') : null;
}

// --- Choix de l'écran ---

function ecranCourant() {
  const { session, job, outil } = vue;
  if (!vue.pret) return null;
  if (!session?.jeton) return 'connexion';
  if (outil) return outil;
  // Un « running » sans moteur qui tourne (worker arrêté par Chrome) : interrompu, à reprendre.
  if (job?.status === 'running') return job.actif === false ? 'pause' : 'cours';
  if (job?.status === 'paused') return 'pause';
  // Sur une fiche produit du drive : la retenir comme référence d'un de tes produits.
  if (vue.ficheOk) return 'ficheok';
  if (vue.fiche) return 'fiche';
  if (job?.status === 'done' && job.finishedAt && vue.finiVu !== job.finishedAt && Date.now() - job.finishedAt < FINI_VISIBLE_MS) return 'fini';
  return 'prete';
}

const ETATS = {
  prete: ['Prête', 'vert'], cours: ['Remplissage', 'accent'], pause: ['En pause', 'ambre'], fini: ['Terminé', 'vert'],
  liste: ['Prête', 'vert'], diagnostic: ['Prête', 'vert'], fiche: ['Fiche', 'accent'], ficheok: ['Fiche', 'accent'],
};

/** Ce qui vaut d'être annoncé au lecteur d'écran : les phases, et l'avancée tous les 5 produits. */
function annoncer(ecran) {
  const job = vue.job;
  const texte = ecran === 'cours' ? `${nom(job.site)} : ${Math.floor(job.cursor / 5) * 5} sur ${job.items.length}`
    : ecran === 'pause' ? 'Remplissage en pause' : ecran === 'fini' ? 'Remplissage terminé' : '';
  if (texte && texte !== vue.annonce) { vue.annonce = texte; $('annonce').textContent = texte; }
}

function rendre() {
  // Le focus survit à la reconstruction des boutons (un message « state » par produit).
  const cleFocus = document.activeElement?.dataset?.cle;
  rendreEcran();
  if (cleFocus) document.querySelector(`[data-cle="${CSS.escape(cleFocus)}"]`)?.focus();
}

function rendreEcran() {
  const ecran = ecranCourant();
  if (!ecran) return;
  annoncer(ecran);
  for (const e of ['connexion', 'prete', 'cours', 'pause', 'fini', 'liste', 'diagnostic', 'fiche', 'ficheok']) $(`ecran-${e}`).hidden = e !== ecran;
  const connecte = Boolean(vue.session?.jeton);
  $('compte-email').textContent = connecte ? `${vue.session.email ?? 'Compte'} · connecté` : 'Non connecté';
  $('menu-email').textContent = vue.session?.email ?? '';
  $('menu-bouton').hidden = !connecte;
  let etat = ETATS[ecran];
  if (ecran === 'prete' && vue.recherches?.etat?.statut === 'en_cours') etat = ['Recherches', 'accent'];
  $('etat').hidden = !etat;
  if (etat && (ecran === 'fiche' || ecran === 'ficheok')) etat = [`Fiche ${nom(vue.fiche.site)}`, 'accent'];
  if (etat) { $('etat-texte').textContent = etat[0]; $('etat').className = `etat etat--${etat[1]}`; }

  const pied = [];
  if (ecran === 'prete') rendrePrete().catch(() => {});
  if (ecran === 'cours') {
    rendreCours();
    // « Arrêter » est définitif : un second appui le confirme.
    pied.push(el('div', { class: 'rangee' },
      bouton('Pause', { icon: 'pause', clair: true, cle: 'pause', onclick: () => send({ type: 'pause' }).then(relireEtat) }),
      bouton(vue.arreter ? 'Arrêter vraiment ?' : 'Arrêter', { icon: 'stop', clair: true, danger: vue.arreter, cle: 'arreter', onclick: () => {
        if (!vue.arreter) { vue.arreter = true; rendre(); setTimeout(() => { vue.arreter = false; rendre(); }, 4000); return; }
        vue.arreter = false; send({ type: 'stop' }).then(relireEtat);
      } })));
  }
  if (ecran === 'pause') {
    rendrePause();
    pied.push(bouton(`Ouvrir l’onglet ${nom(vue.job.site)}`, { icon: 'link-square-02', clair: true, cle: 'onglet', onclick: ouvrirOnglet }));
    const simple = vue.job.pauseReason === 'manuel' || vue.job.status === 'running';
    pied.push(bouton(simple ? 'Reprendre' : 'C’est fait, reprendre', { icon: 'play', cle: 'reprendre', onclick: () => send({ type: 'resume' }).then(relireEtat) }));
  }
  if (ecran === 'fini') {
    rendreFini();
    pied.push(el('div', { class: 'rangee' },
      bouton(`Onglet ${nom(vue.job.site)}`, { icon: 'link-square-02', clair: true, cle: 'onglet', onclick: ouvrirOnglet }),
      bouton('Terminer', { cle: 'terminer', onclick: terminerFini })));
  }
  if (ecran === 'liste') {
    pied.push(el('div', { class: 'rangee' },
      bouton('Annuler', { clair: true, onclick: () => { vue.outil = null; rendre(); } }),
      bouton('Remplir le panier', { icon: 'shopping-cart-01', onclick: lancerListe })));
  }
  if (ecran === 'fiche') {
    rendreFiche();
    const p = vue.catalogue.find((x) => x.id === vue.choixFiche), eq = p && vue.equivalences.get(p.id);
    const deja = eq && !eq.unavailable && eq.product_url === vue.fiche.url;
    pied.push(bouton(!p ? 'Choisis un de tes produits' : deja ? 'Déjà sa référence' : `Retenir pour « ${p.name} »`,
      { icon: 'tick-02', cle: 'retenir', disabled: !p || deja || vue.ficheEnvoi, onclick: retenirFiche }));
  }
  if (ecran === 'ficheok') {
    rendreFicheOk();
    pied.push(el('div', { class: 'rangee' },
      bouton('Annuler', { icon: 'arrow-turn-backward', clair: true, cle: 'annuler-fiche', onclick: annulerFiche }),
      bouton('Terminé', { cle: 'termine-fiche', onclick: () => window.close() })));
  }
  if (ecran === 'diagnostic') pied.push(bouton('Retour', { clair: true, onclick: () => { vue.outil = null; rendre(); } }));
  $('pied').replaceChildren(...pied);
  $('pied').hidden = !pied.length;
}

// --- Écran « prête » ---

async function rendrePrete() {
  const premier = vue.travaux?.enAttente?.[0];
  if (premier) {
    const n = premier.items?.length ?? 0, drives = (premier.drives ?? []).map(nom).join(' puis ');
    $('prete-titre').textContent = 'Une liste attend';
    $('prete-texte').textContent = `${n} produit${n > 1 ? 's' : ''} pour ${drives}. Le remplissage part de lui-même dans les 30 secondes.`;
    $('remplir').hidden = false;
    $('remplir').dataset.jobId = premier.id;
  } else {
    $('prete-titre').textContent = 'Tout est prêt';
    $('prete-texte').textContent = 'Envoie ta liste depuis l’iPhone : le panier se remplit tout seul, dans les 30 secondes.';
    $('remplir').hidden = true;
  }
  rendreRecherches();

  const job = vue.job;
  const montrerDernier = job && ['done', 'stopped'].includes(job.status);
  $('dernier').hidden = !montrerDernier;
  if (montrerDernier) {
    const quand = job.finishedAt ? new Date(job.finishedAt) : null;
    $('dernier-titre').textContent = quand
      ? `DERNIER REMPLISSAGE · ${quand.toLocaleDateString('fr-FR', { weekday: 'long' }).toUpperCase()} ${quand.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
      : 'DERNIER REMPLISSAGE';
    $('dernier-drives').replaceChildren(...drivesDu(job).filter((d) => d.lignes.length).map((d) =>
      ligneDrive(d.drive, `${ajoutes(d.lignes)} sur ${d.total} au panier`, ajoutes(d.lignes), d.total)));
  }

  const { magasins = {} } = await chrome.storage.local.get('magasins');
  const magasin = magasins.leclerc?.match(/magasin-\d+-\d+-([^/]+)/)?.[1]?.replace(/-/g, ' ');
  $('tes-drives').replaceChildren(
    el('div', { class: 'mon-drive' }, icone('store-01'),
      el('span', { class: 'mon-drive__texte' }, el('b', { text: 'E.Leclerc' }), magasin ? ` · ${magasin}` : ' · magasin pas encore vu'),
      el('button', { class: 'mon-drive__action', onclick: () => chrome.tabs.create({ url: magasins.leclerc ?? SITES.leclerc.origin }) , text: magasin ? 'Ouvrir' : 'Choisir' })),
    el('div', { class: 'mon-drive' }, icone('store-01'),
      el('span', { class: 'mon-drive__texte' }, el('b', { text: 'Carrefour' }), ' · carrefour.fr'),
      el('button', { class: 'mon-drive__action', onclick: () => chrome.tabs.create({ url: SITES.carrefour.origin }), text: 'Ouvrir' })));
}

function rendreRecherches() {
  const donnees = vue.recherches, etat = donnees?.etat ?? null, aFaire = donnees?.aFaire ?? 0, auto = donnees?.auto !== false;
  $('recherches-auto').checked = auto;
  $('menu-auto-detail').textContent = auto ? 'Activées · depuis l’iPhone' : 'Désactivées : à lancer ici';
  const enCours = etat?.statut === 'en_cours';
  $('recherches').hidden = !enCours && !aFaire && etat?.statut !== 'pause';
  if ($('recherches').hidden) return;
  $('recherches-resume').textContent = enCours
    ? `${etat.fait ?? 0} sur ${etat.total ?? 0} · ${nom(etat.drive)}${etat.requete ? ` · « ${etat.requete} »` : ''}`
    : `${aFaire} recherche${aFaire > 1 ? 's' : ''} demandée${aFaire > 1 ? 's' : ''} depuis l’iPhone`;
  $('recherches-barre-fond').hidden = !enCours;
  const pctRech = enCours && etat.total ? Math.round(((etat.fait ?? 0) / etat.total) * 100) : 0;
  $('recherches-barre').style.width = `${pctRech}%`;
  $('recherches-barre-fond').setAttribute('aria-valuenow', String(pctRech));
  $('recherches-message').textContent = etat?.message
    ?? (enCours ? 'Une recherche toutes les 8 à 15 secondes, à rythme humain.' : auto ? 'Elles partent d’elles-mêmes dans les 30 secondes.' : 'Le lancement automatique est désactivé.');
  $('recherches-lancer').hidden = enCours || !aFaire;
  $('recherches-lancer').textContent = etat?.statut === 'pause' ? 'Relancer les recherches' : 'Lancer les recherches';
  $('recherches-pause').hidden = !enCours;
}

// --- Écran « en cours » ---

function rendreCours() {
  const job = vue.job, item = job.items?.[job.cursor];
  $('actuel-drive').textContent = `EN TRAIN D’AJOUTER · ${nom(job.site).toUpperCase()}`;
  $('actuel-nom').textContent = item ? plat(item.name) : 'Dernières vérifications';
  $('actuel-detail').textContent = item ? `× ${item.quantity ?? 1} · ${job.cursor + 1} sur ${job.items.length}` : '';
  const drives = drivesDu(job);
  $('cours-drives').replaceChildren(...drives.map((d) => d.courant
    ? ligneDrive(d.drive, `${job.cursor} sur ${d.total}`, job.cursor, d.total)
    : d.fini ? ligneDrive(d.drive, `fini · ${ajoutes(d.lignes)} au panier`, d.total, d.total, 'fini')
      : ligneDrive(d.drive, 'à suivre', 0, d.total)));
  const reste = (job.items.length - job.cursor) + drives.filter((d) => !d.fini && !d.courant).length * job.items.length;
  const minutes = Math.max(1, Math.round((reste * SECONDES_PAR_PRODUIT) / 60));
  $('cours-temps').textContent = `Encore ${minutes} minute${minutes > 1 ? 's' : ''} environ, à rythme humain. Tu peux utiliser Chrome, mais laisse l’onglet du drive tranquille.`;
  const recents = (job.results ?? []).slice(-5).reverse();
  $('recents').replaceChildren(...(recents.length ? recents.map((r) => {
    const [ton, ic] = puceDe(r);
    return el('div', { class: 'recent' },
      el('div', { class: 'recent__texte' }, el('p', { class: 'recent__nom', text: plat(r.item) }), el('p', { class: 'recent__detail', text: detailLigne(r) })),
      el('span', { class: `puce puce--${ton}`, 'aria-label': r.ok ? 'ajouté' : 'non ajouté' }, icone(ic)));
  }) : [el('p', { class: 'sous', style: 'padding:10px 0', text: 'Les premiers produits arrivent…' })]));
}

// --- Écran « en pause » ---

function rendrePause() {
  const job = vue.job, d = nom(job.site);
  const textes = {
    challenge: ['user-check-01', `${d} demande une vérification`, `Le site veut s’assurer qu’un humain est là. Fais-la dans l’onglet ${d}, puis reprends : le remplissage repart où il s’est arrêté.`],
    magasin: ['location-01', `Choisis ton magasin ${d}`, `Ouvre l’onglet ${d}, choisis ton magasin, puis reprends : les recherches viseront ce magasin.`],
    manuel: ['pause', 'Remplissage en pause', 'Reprends quand tu veux : il repart où il s’est arrêté.'],
    interrompu: ['pause-circle', 'Remplissage interrompu', 'Chrome a mis l’extension en veille en plein remplissage. Reprends : il repart où il s’est arrêté.'],
  };
  const [ic, titre, texte] = textes[job.status === 'running' ? 'interrompu' : job.pauseReason] ?? textes.challenge;
  $('pause-icone').className = `hgi-stroke hgi-${ic}`;
  $('pause-titre').textContent = titre;
  $('pause-texte').textContent = texte;
  const total = job.items?.length ?? 0;
  $('pause-drives').replaceChildren(ligneDrive(job.site, `arrêté à ${job.cursor} sur ${total}`, job.cursor, total, 'ambre'));
}

// --- Écran « terminé » ---

function rendreFini() {
  const drives = drivesDu(vue.job).filter((d) => d.lignes.length);
  const total = drives.reduce((n, d) => n + ajoutes(d.lignes), 0);
  $('fini-titre').textContent = `${total} produit${total > 1 ? 's' : ''} au panier`;
  $('fini-texte').textContent = drives.map((d) => `${nom(d.drive)} ${ajoutes(d.lignes)} sur ${d.total}`).join(' · ');
  // Seules les lignes du dernier drive se choisissent ici : son onglet est encore ouvert.
  const choix = (vue.job.results ?? []).map((r, index) => ({ r, index })).filter(({ r, index }) => (!r.ok && r.candidates?.length) || (r.chosen && vue.choisis[index] === 'fait'));
  $('choix').hidden = !choix.length;
  $('choix-titre').textContent = `À CHOISIR TOI-MÊME · ${choix.length}`;
  $('choix-liste').replaceChildren(...choix.slice(0, 4).map(({ r, index }) => carteChoix(r, index)));
}

function carteChoix(r, index) {
  const ref = vue.job.items?.[index];
  const retenu = vue.choisis[index];
  const carte = el('div', { class: 'carte' },
    el('div', {}, el('p', { class: 'choix__nom', text: plat(r.item) }),
      el('p', { class: 'sous', text: `${nom(vue.job.site)}${ref?.grammage_g ? ` · ta référence fait ${ref.grammage_g} g` : ref?.volume_ml ? ` · ta référence fait ${ref.volume_ml} ml` : ''}` })));
  if (retenu === 'fait') {
    carte.append(el('p', { class: 'choix__fait' }, icone('tick-02'), 'Ajouté au panier'));
    return carte;
  }
  const formats = el('div', { class: 'choix__formats', role: 'group', 'aria-label': `Choix pour ${plat(r.item)}` },
    r.candidates.slice(0, 3).map((c) => {
      const label = c.label ?? c, f = formatDe(label), on = retenu === label;
      return el('button', { class: 'format', 'aria-pressed': on ? 'true' : 'false', title: plat(label), 'data-cle': `format-${index}-${label}`,
        onclick: () => { vue.choisis[index] = on ? undefined : label; rendre(); } },
        el('span', { class: 'format__titre', text: f ?? plat(label).split(' ').slice(0, 2).join(' ') }),
        el('span', { class: 'format__sous', text: plat(label) }));
    }));
  // Un seul ajout à la fois : deux choix piloteraient le même onglet en même temps.
  const occupe = vue.job.status === 'running' || Object.values(vue.choisis).includes('envoi');
  carte.append(formats,
    bouton(typeof retenu === 'string' && retenu !== 'envoi' ? `Ajouter ${formatDe(retenu) ?? 'ce produit'} au panier` : retenu === 'envoi' ? 'Ajout…' : 'Choisis un produit',
      { icon: 'add-01', disabled: occupe || !retenu, cle: `ajouter-${index}`, onclick: () => choisir(index, retenu) }));
  if (vue.erreurs[index]) carte.append(el('p', { class: 'erreur', role: 'alert', text: vue.erreurs[index] }));
  return carte;
}

async function choisir(index, label) {
  vue.choisis[index] = 'envoi'; delete vue.erreurs[index]; rendre();
  const res = await send({ type: 'choose', index, label });
  if (res?.ok && res.data?.ok) vue.choisis[index] = 'fait';
  else { vue.choisis[index] = label; vue.erreurs[index] = 'L’ajout n’a pas pris. Vérifie l’onglet du drive, puis réessaie.'; }
  await relireEtat();
}

async function terminerFini() {
  vue.finiVu = vue.job?.finishedAt ?? null;
  await chrome.storage.local.set({ popup_fini_vu: vue.finiVu });
  rendre();
}

async function ouvrirOnglet() {
  const job = vue.job;
  try {
    const t = await chrome.tabs.update(job.tabId, { active: true });
    await chrome.windows.update(t.windowId, { focused: true });
  } catch {
    chrome.tabs.create({ url: SITES[job.site]?.origin });
  }
}

// --- Sur une fiche produit ---

/** Lit, dans l'onglet actif, la fiche produit du drive : nom, prix, photo. Null hors d'une fiche. */
async function detecterFiche() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const u = new URL(tab?.url ?? '');
    const site = Object.entries(SITES).find(([, cfg]) => cfg.hostPattern?.test(u.hostname))?.[0];
    const cfg = site && SITES[site], motif = cfg && (cfg.productPagePattern ?? cfg.productUrlPattern);
    if (!motif || !new RegExp(motif).test(u.pathname)) return null;
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [cfg.productPage ?? {}],
      func: (sel) => {
        const premier = (liste) => { for (const s of liste ?? []) { try { const e = document.querySelector(s); if (e?.textContent.trim()) return e; } catch { /* sélecteur propre à l'agent */ } } return null; };
        const plat = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
        const prixTexte = plat(premier(sel.price)?.textContent);
        const m = prixTexte.match(/(\d+)\s*[€,.]\s*[,.]?\s*(\d{2})/);
        const unite = plat(document.body.innerText).match(/\d+[,.]\d{2}\s*€\s*\/\s*[a-zA-Z]+/)?.[0] ?? null;
        const image = document.querySelector('meta[property="og:image"]')?.content ?? null;
        return { titre: plat((premier(sel.title) ?? document.querySelector('h1'))?.textContent), prix: m ? `${m[1]},${m[2]} €` : null, unite, image };
      },
    });
    if (!result?.titre) return null;
    const ean = cfg.productUrlPattern ? u.pathname.match(new RegExp(cfg.productUrlPattern))?.[1] ?? null : null;
    return { ...result, site, url: u.origin + u.pathname, ean, magasin: u.pathname.match(/magasin-\d+-\d+-([^/]+)/)?.[1]?.replace(/-/g, ' ') ?? null };
  } catch { return null; }
}

async function chargerFiche() {
  const fiche = await detecterFiche();
  if (!fiche) return;
  vue.fiche = fiche;
  const [prod, eqs] = await Promise.all([lireProduits(), equivalencesDe(fiche.site)]);
  vue.catalogue = prod?.ok ? prod.data ?? [] : [];
  vue.equivalences = new Map((eqs?.ok ? eqs.data ?? [] : []).map((e) => [e.product_id, e]));
  vue.choixFiche = produitsProches(fiche.titre, vue.catalogue, 1)[0]?.id ?? null;
}

function rendreFiche() {
  const f = vue.fiche, d = nom(f.site);
  $('fiche-image').src = f.image ?? '';
  $('fiche-image').hidden = !f.image;
  $('fiche-surtitre').textContent = `CETTE FICHE · ${d.toUpperCase()}${f.magasin ? ` ${f.magasin.toUpperCase()}` : ''}`;
  $('fiche-titre').textContent = f.titre;
  $('fiche-prix').textContent = [f.prix, f.unite].filter(Boolean).join(' · ');
  $('fiche-question').textContent = `C’EST LA RÉFÉRENCE ${d.toUpperCase()} DE…`;
  const autre = Object.keys(NOM).find((x) => x !== f.site);
  $('fiche-note').textContent = `À la prochaine commande, l’extension ira droit à cette fiche pour ce produit chez ${d}.${autre ? ` ${nom(autre)} n’est pas touché.` : ''}`;
  const liste = vue.rechercheFiche.trim() ? chercherProduits(vue.rechercheFiche, vue.catalogue) : produitsProches(f.titre, vue.catalogue, 4);
  $('fiche-liste-titre').textContent = vue.rechercheFiche.trim()
    ? (liste.length ? 'Tes produits' : `Aucun de tes produits ne contient « ${vue.rechercheFiche.trim()} ».`)
    : (liste.length ? 'Proches de cette fiche' : 'Aucun de tes produits ne ressemble à cette fiche : cherche-le ci-dessus.');
  $('fiche-produits').replaceChildren(...liste.map((p) => {
    const eq = vue.equivalences.get(p.id), on = vue.choixFiche === p.id;
    const detail = eq?.unavailable ? `${d} : noté absent` : eq?.product_url === f.url ? 'déjà cette fiche' : eq ? `Aujourd’hui : « ${plat(eq.matched_label ?? eq.search_query)} »` : `${d} : pas encore de référence`;
    return el('button', { class: 'option', role: 'radio', 'aria-checked': on ? 'true' : 'false', 'data-cle': `option-${p.id}`,
      onclick: () => { vue.choixFiche = on ? null : p.id; rendre(); } },
      p.image_url ? el('img', { class: 'option__photo', src: p.image_url, alt: '' }) : el('span', { class: 'option__photo', 'aria-hidden': 'true' }),
      el('span', { class: 'option__texte' }, el('span', { class: 'option__nom', text: p.name }), el('span', { class: 'option__detail', text: detail, style: 'display:block' })),
      el('span', { class: 'radio', 'aria-hidden': 'true' }, on ? icone('tick-02') : null));
  }));
}

async function retenirFiche() {
  const f = vue.fiche, p = vue.catalogue.find((x) => x.id === vue.choixFiche);
  if (!p || vue.ficheEnvoi) return;
  vue.ficheEnvoi = true; $('fiche-erreur').hidden = true; rendre();
  const avant = vue.equivalences.get(p.id) ?? null;
  const res = await enregistrerEquivalence({ product_id: p.id, drive: f.site, search_query: p.name, matched_label: f.titre, product_url: f.url, ean13: f.ean ?? null, unavailable: false });
  vue.ficheEnvoi = false;
  if (!res?.ok) { $('fiche-erreur').textContent = res?.deconnecte ? 'Session expirée : reconnecte-toi, puis réessaie.' : 'Impossible d’enregistrer pour le moment. Réessaie.'; $('fiche-erreur').hidden = false; rendre(); return; }
  vue.ficheOk = { produit: p, avant };
  vue.equivalences.set(p.id, { product_id: p.id, drive: f.site, matched_label: f.titre, product_url: f.url });
  rendre();
}

function rendreFicheOk() {
  const { produit, avant } = vue.ficheOk, d = nom(vue.fiche.site);
  $('ficheok-titre').textContent = `Référence ${d} ${avant ? 'changée' : 'retenue'}`;
  $('ficheok-texte').textContent = `« ${produit.name} » prendra désormais cette fiche chez ${d}${avant && !avant.unavailable && avant.matched_label ? `, au lieu de « ${plat(avant.matched_label)} »` : ''}.`;
}

async function annulerFiche() {
  const { produit, avant } = vue.ficheOk, site = vue.fiche.site;
  $('ficheok-erreur').hidden = true;
  const res = avant
    ? await enregistrerEquivalence({ product_id: produit.id, drive: site, search_query: avant.search_query ?? produit.name, matched_label: avant.matched_label ?? null, product_url: avant.product_url ?? null, ean13: avant.ean13 ?? null, unavailable: !!avant.unavailable })
    : await supprimerEquivalence(produit.id, site);
  if (!res?.ok) { $('ficheok-erreur').textContent = 'Impossible d’annuler pour le moment. Réessaie.'; $('ficheok-erreur').hidden = false; return; }
  if (avant) vue.equivalences.set(produit.id, avant); else vue.equivalences.delete(produit.id);
  vue.ficheOk = null;
  rendre();
}

$('fiche-recherche').addEventListener('input', (e) => { vue.rechercheFiche = e.target.value; rendre(); });

// --- Outils du menu ---

async function lancerListe() {
  const items = parseItems($('items').value);
  if (!items.length) { $('liste-erreur').textContent = 'Écris au moins un produit.'; $('liste-erreur').hidden = false; return; }
  $('liste-erreur').hidden = true;
  const res = await send({ type: 'start', payload: { site: $('site').value, items } });
  if (!res?.ok) { $('liste-erreur').textContent = `Impossible de lancer : ${String(res?.error ?? '').replace(/^Error: /, '')}`; $('liste-erreur').hidden = false; return; }
  vue.outil = null;
  await relireEtat();
}

async function detecterSite() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const host = new URL(tab?.url ?? '').hostname;
    return Object.entries(SITES).find(([, cfg]) => cfg.hostPattern?.test(host))?.[0] ?? null;
  } catch { return null; }
}

function fermerMenu() { $('menu').hidden = true; $('menu-bouton').setAttribute('aria-expanded', 'false'); }
$('menu-bouton').addEventListener('click', (e) => {
  e.stopPropagation();
  const ouvrir = $('menu').hidden;
  $('menu').hidden = !ouvrir;
  $('menu-bouton').setAttribute('aria-expanded', String(ouvrir));
  if (ouvrir) $('menu').querySelector('input, button')?.focus();
});
document.addEventListener('click', (e) => { if (!$('menu').contains(e.target)) fermerMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('menu').hidden) { fermerMenu(); $('menu-bouton').focus(); } });
$('menu').addEventListener('focusout', (e) => { if (!$('menu').contains(e.relatedTarget) && e.relatedTarget !== $('menu-bouton')) fermerMenu(); });
$('menu-liste').addEventListener('click', async () => {
  fermerMenu();
  $('site').value = (await detecterSite()) ?? 'carrefour';
  vue.outil = 'liste'; rendre(); $('items').focus();
});
$('menu-diagnostic').addEventListener('click', async () => {
  fermerMenu();
  const site = await detecterSite();
  vue.outil = 'diagnostic'; rendre();
  if (!site) { $('diag-resume').textContent = 'Ouvre d’abord une page Carrefour ou E.Leclerc dans l’onglet actif.'; $('diag').textContent = ''; return; }
  $('diag-resume').textContent = `Page ${nom(site)} : lecture en cours…`;
  const res = await send({ type: 'diagnose', site });
  $('diag-resume').textContent = `Ce que l’extension voit sur cette page ${nom(site)}, à copier pour signaler un souci.`;
  $('diag').textContent = JSON.stringify(res?.data ?? res, null, 2);
});
$('recherches-auto').addEventListener('change', async () => { await send({ type: 'reglerAuto', actif: $('recherches-auto').checked }); await relireRecherches(); });
$('deconnexion').addEventListener('click', async () => { fermerMenu(); await deconnexion(); await relireCompte(); });

// --- Actions des écrans ---

$('connexion').addEventListener('click', async () => {
  const email = $('email').value.trim(), mdp = $('mdp').value;
  if (!email || !mdp) { $('compte-erreur').textContent = 'Renseigne ton adresse et ton mot de passe.'; $('compte-erreur').hidden = false; return; }
  $('compte-erreur').hidden = true;
  $('connexion').disabled = true; $('connexion').textContent = 'Connexion…';
  const res = await connexion(email, mdp);
  $('connexion').disabled = false; $('connexion').textContent = 'Se connecter';
  if (!res.ok) { $('compte-erreur').textContent = res.erreur; $('compte-erreur').hidden = false; return; }
  $('mdp').value = '';
  await relireCompte();
});
$('mdp').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('connexion').click(); });
$('remplir').addEventListener('click', async () => {
  const jobId = $('remplir').dataset.jobId;
  if (!jobId) return;
  $('remplir').disabled = true;
  const res = await send({ type: 'demarrerTravail', jobId });
  $('remplir').disabled = false;
  if (!res?.ok) $('prete-texte').textContent = `Impossible de démarrer : ${String(res?.error ?? '').replace(/^Error: /, '')}`;
  await relireEtat();
});
$('recherches-lancer').addEventListener('click', async () => {
  $('recherches-lancer').disabled = true;
  const res = await send({ type: 'lancerRecherches' });
  $('recherches-lancer').disabled = false;
  await relireRecherches();
  if (!res?.ok) $('recherches-message').textContent = `Impossible de lancer : ${String(res?.error ?? 'erreur inconnue').replace(/^Error: /, '')}`;
});
$('recherches-pause').addEventListener('click', async () => { await send({ type: 'pauseRecherches' }); await relireRecherches(); });

// --- Lectures ---

function recevoirJob(job) {
  if ((job?.startedAt ?? null) !== (vue.job?.startedAt ?? null)) { vue.choisis = {}; vue.erreurs = {}; }
  vue.job = job;
}
async function relireEtat() { const r = await send({ type: 'getState' }); recevoirJob(r?.data ?? null); rendre(); }
async function relireRecherches() { const r = await send({ type: 'recherches' }); if (r?.ok) vue.recherches = r.data; rendre(); }
async function relireCompte() {
  vue.session = await sessionCourante();
  if (vue.session?.jeton) {
    const res = await send({ type: 'travaux' });
    if (res?.data?.deconnecte || res?.deconnecte) {
      vue.session = null;
      $('compte-erreur').textContent = 'Session expirée, reconnecte-toi.';
      $('compte-erreur').hidden = false;
    } else if (res?.ok) vue.travaux = res.data?.data ?? null;
    await relireRecherches();
  }
  rendre();
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'state') { recevoirJob(msg.state); rendre(); }
  if (msg?.type === 'recherches') relireRecherches();
});

(async () => {
  ({ popup_fini_vu: vue.finiVu = null } = await chrome.storage.local.get('popup_fini_vu'));
  const [etat] = await Promise.all([send({ type: 'getState' }), sessionCourante().then((s) => { vue.session = s; })]);
  recevoirJob(etat?.data ?? null);
  if (vue.session?.jeton) await chargerFiche();
  // Rien ne s'affiche avant de savoir qui est connecté : pas d'écran de connexion qui clignote.
  vue.pret = true;
  await relireCompte();
})();
