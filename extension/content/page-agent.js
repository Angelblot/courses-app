/**
 * Code injecté dans la page du drive.
 *
 * Exporté comme une fonction unique et autonome : `chrome.scripting.executeScript`
 * sérialise la fonction, elle ne peut donc rien capturer de son module d'origine.
 * Toutes ses dépendances sont définies à l'intérieur.
 */

/**
 * Cherche un produit dans la page de résultats et l'ajoute au panier.
 *
 * @param {object} cfg Configuration de l'enseigne (voir sites.js).
 * @param {object} item Ligne de courses : {name, quantity, unit, brand}.
 * @param {string} mode 'run' pour agir, 'diagnose' pour seulement observer.
 * @returns {Promise<object>} Compte rendu de l'opération.
 */
export function pageAgent(cfg, item, mode) {
  // --- Sélecteurs étendus : gère le pseudo :has-text('...') absent du CSS natif ---
  const HAS_TEXT = /^(.*?):has-text\((['"])(.*?)\2\)$/;

  /**
   * Texte d'un élément, avec repli sur textContent.
   *
   * innerText renvoie une chaîne vide pour tout élément non rendu — carrousel
   * hors écran, panneau replié, contenu chargé mais masqué. Sur la page
   * d'accueil Carrefour, cela vidait tous les titres lus et faisait échouer la
   * recherche de boutons par texte.
   */
  const textOf = (el) => ((el?.innerText || '').trim() || (el?.textContent || '').trim());

  function queryAll(root, selector) {
    const m = selector.match(HAS_TEXT);
    if (!m) {
      try {
        return [...root.querySelectorAll(selector)];
      } catch {
        return [];
      }
    }
    const [, base, , text] = m;
    const needle = text.toLowerCase();
    let candidates;
    try {
      candidates = [...root.querySelectorAll(base || '*')];
    } catch {
      return [];
    }
    return candidates.filter((el) => textOf(el).toLowerCase().includes(needle));
  }

  function queryFirst(root, selectors) {
    for (const sel of selectors) {
      const found = queryAll(root, sel);
      if (found.length) return found[0];
    }
    return null;
  }

  function queryFirstList(root, selectors) {
    for (const sel of selectors) {
      const found = queryAll(root, sel);
      if (found.length) return { selector: sel, elements: found };
    }
    return { selector: null, elements: [] };
  }

  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // --- Normalisation et score de correspondance ---

  function normalize(s) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // accents
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const STOP_WORDS = new Set(['de', 'du', 'la', 'le', 'les', 'des', 'a', 'au', 'en', 'et']);

  /**
   * Score de 0 à 1 entre le libellé recherché et le titre d'un résultat.
   *
   * Les mots sont pondérés par leur longueur : dans « Spaghetti Barilla », la
   * marque discrimine bien plus que le type de pâte. Sans cette pondération,
   * une recherche « Spaghetti Barilla » face à un roman intitulé « Le Syndrome
   * du spaghetti » obtient 0,5 — assez pour passer un seuil naïf et faire
   * entrer un livre dans le panier. Cas réellement observé sur Leclerc.
   */
  function score(wanted, candidate) {
    const w = normalize(wanted).split(' ').filter((t) => t && !STOP_WORDS.has(t));
    const c = normalize(candidate);
    if (!w.length || !c) return 0;
    const total = w.reduce((sum, t) => sum + t.length, 0);
    const hit = w.reduce((sum, t) => sum + (c.includes(t) ? t.length : 0), 0);
    return total ? hit / total : 0;
  }

  /**
   * Seuil d'acceptation, volontairement exigeant.
   *
   * Un produit manqué est signalé à l'utilisateur, qui l'ajoute lui-même ; un
   * mauvais produit ajouté en silence se découvre à la livraison. On préfère
   * donc rater que se tromper.
   */
  const MATCH_THRESHOLD = 0.75;

  // --- Détection d'état de page ---

  function pageState() {
    const text = textOf(document.body).toLowerCase();
    if (cfg.challengeHints.some((h) => text.includes(h))) return 'challenge';
    return 'ok';
  }

  async function dismissCookies() {
    const btn = queryFirst(document, cfg.cookieReject);
    if (btn && isVisible(btn)) {
      btn.click();
      await sleep(1200);
      return true;
    }
    return false;
  }

  /**
   * Attend que des cartes produit apparaissent (rendu asynchrone fréquent).
   */
  async function waitForCards(timeoutMs = 12000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const { selector, elements } = queryFirstList(document, cfg.cards);
      if (elements.length) return { selector, elements };
      await sleep(400);
    }
    return { selector: null, elements: [] };
  }

  // --- Mode diagnostic : décrire la page sans rien cliquer ---

  function diagnose() {
    const report = {
      url: location.href,
      title: document.title,
      state: pageState(),
      cardSelectors: {},
      addButtonSelectors: {},
    };
    for (const sel of cfg.cards) report.cardSelectors[sel] = queryAll(document, sel).length;
    for (const sel of cfg.addButton) report.addButtonSelectors[sel] = queryAll(document, sel).length;

    const { selector: cardSelector, elements } = queryFirstList(document, cfg.cards);
    report.cardSelectorUsed = cardSelector;

    // Pour chaque carte échantillon : quel sélecteur de titre donne du texte,
    // et quel bouton d'ajout est présent. C'est ce qui permet de trancher.
    report.samples = elements.slice(0, 4).map((card) => {
      const titles = {};
      for (const sel of cfg.title) {
        const el = queryAll(card, sel)[0];
        const t = textOf(el);
        if (t) titles[sel] = t.slice(0, 70);
      }
      const buttons = {};
      for (const sel of cfg.addButton) buttons[sel] = queryAll(card, sel).length;
      return {
        cardText: textOf(card).replace(/\s+/g, ' ').slice(0, 120),
        titles,
        buttons,
        link: card.querySelector('a')?.getAttribute('href')?.slice(0, 80) ?? null,
      };
    });

    // Repli utile quand aucun sélecteur de carte ne marche : les liens produit.
    report.productLinks = document.querySelectorAll('a[href*="/p/"], a[href*="fiche-produit"]').length;
    report.isSearchPage = /[?&]q=/.test(location.search) || /recherche/.test(location.pathname);
    return report;
  }

  // --- Programme principal ---

  return (async () => {
    await sleep(800);

    const state = pageState();
    if (state === 'challenge') {
      return { ok: false, reason: 'challenge', message: 'Vérification anti-robot affichée' };
    }

    await dismissCookies();

    if (mode === 'diagnose') return { ok: true, reason: 'diagnose', report: diagnose() };

    const { selector: cardSelector, elements: cards } = await waitForCards();
    if (!cards.length) {
      return {
        ok: false,
        reason: 'no_results',
        message: 'Aucune carte produit reconnue',
        diagnostic: diagnose(),
      };
    }

    // Meilleur candidat par score sur le titre.
    let best = null;
    for (const card of cards.slice(0, 12)) {
      const titleEl = queryFirst(card, cfg.title);
      const label = textOf(titleEl) || textOf(card);
      const s = score(item.name, label);
      if (!best || s > best.score) best = { card, label, score: s };
    }

    if (!best || best.score < MATCH_THRESHOLD) {
      return {
        ok: false,
        reason: 'no_match',
        message: `Aucun résultat convaincant pour « ${item.name} »`,
        bestLabel: best?.label ?? null,
        bestScore: best?.score ?? 0,
      };
    }

    const addBtn = queryFirst(best.card, cfg.addButton);
    if (!addBtn || !isVisible(addBtn)) {
      return {
        ok: false,
        reason: 'no_add_button',
        message: `Bouton d'ajout introuvable pour « ${best.label} »`,
        cardSelector,
      };
    }

    addBtn.scrollIntoView({ block: 'center' });
    await sleep(300);
    addBtn.click();
    await sleep(1500);

    // Quantité > 1 : cliquer le "+" autant que nécessaire.
    const wanted = Math.max(1, Math.round(Number(item.quantity) || 1));
    let added = 1;
    if (wanted > 1) {
      const plus = queryFirst(best.card, [
        '[data-testid="quantity-plus"]',
        'button[aria-label*="ugmenter"]',
        '.quantity-plus',
        "button:has-text('+')",
      ]);
      for (let i = 1; i < wanted && plus && isVisible(plus); i++) {
        plus.click();
        added += 1;
        await sleep(500);
      }
    }

    const priceEl = queryFirst(best.card, cfg.price);
    return {
      ok: true,
      reason: 'added',
      label: best.label,
      score: Number(best.score.toFixed(2)),
      quantityAdded: added,
      quantityWanted: wanted,
      price: (priceEl?.innerText || '').trim().slice(0, 30) || null,
    };
  })();
}
