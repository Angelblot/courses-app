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

  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


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

  /**
   * Premier élément réellement actionnable parmi les candidats.
   *
   * Un sélecteur peut désigner le conteneur de la carte plutôt que son bouton :
   * le clic part alors dans le vide et l'ajout échoue en silence. On exige donc
   * un <button> (ou role=button) visible et non désactivé.
   */
  function queryFirstClickable(root, selectors) {
    for (const sel of selectors) {
      for (const el of queryAll(root, sel)) {
        const isButton = el.tagName === 'BUTTON' || el.getAttribute('role') === 'button';
        if (isButton && isVisible(el) && !el.disabled) return el;
      }
    }
    // Aucun vrai bouton : on retombe sur le premier élément visible, faute de mieux.
    for (const sel of selectors) {
      const el = queryAll(root, sel).find(isVisible);
      if (el) return el;
    }
    return null;
  }

  /**
   * Empreinte d'une carte, pour détecter qu'un clic a produit un effet.
   * Après un ajout réussi, le bouton laisse place à un sélecteur de quantité :
   * le texte et le nombre de champs changent.
   */
  function fingerprint(card) {
    return [
      textOf(card).replace(/\s+/g, ' '),
      card.querySelectorAll('input').length,
      card.querySelectorAll('button').length,
    ].join('|');
  }

  /** Compteur d'articles du panier, s'il est exposé dans l'en-tête. */
  function cartCount() {
    const el = document.querySelector(
      '[data-testid="cart-count"], [class*="cart"] [class*="count"], [class*="basket"] [class*="count"]'
    );
    const n = parseInt(textOf(el).replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? n : null;
  }

  function queryFirstList(root, selectors) {
    for (const sel of selectors) {
      const found = queryAll(root, sel);
      if (found.length) return { selector: sel, elements: found };
    }
    return { selector: null, elements: [] };
  }

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

  /** En deçà de cet écart, deux candidats sont jugés indiscernables. */
  const AMBIGUITY_MARGIN = 0.05;

  /**
   * Mots du candidat absents de la recherche, hors bruit.
   *
   * « Lardons fumés » obtient 1,0 face à « Lardons fumés », « Lardons fumés
   * BIO » et « Lardons fumés allégés » : le score seul ne les départage pas et
   * le premier arrivé l'emporte, au hasard du tri du site. Le nombre de mots
   * superflus tranche — le produit le plus simple est presque toujours celui
   * qu'on voulait.
   */
  function extraTokens(wanted, candidate) {
    const w = new Set(normalize(wanted).split(' ').filter(Boolean));
    return normalize(candidate)
      .split(' ')
      .filter((t) => t.length > 2 && !w.has(t) && !STOP_WORDS.has(t) && !/^\d+$/.test(t)).length;
  }

  /**
   * Classe les candidats : score décroissant, puis le moins de mots superflus,
   * puis le libellé le plus court.
   */
  function rank(wanted, candidates) {
    return candidates
      .map((c) => ({
        ...c,
        score: score(wanted, c.label),
        extra: extraTokens(wanted, c.label),
      }))
      .sort(
        (a, b) =>
          b.score - a.score || a.extra - b.extra || a.label.length - b.label.length
      );
  }

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
      // Nature réelle des candidats : un conteneur non cliquable se repère ici.
      const buttons = {};
      for (const sel of cfg.addButton) {
        const els = queryAll(card, sel);
        if (els.length) {
          buttons[sel] = els.map((e) => ({
            tag: e.tagName.toLowerCase(),
            texte: textOf(e).slice(0, 25),
            aria: e.getAttribute('aria-label')?.slice(0, 30) ?? null,
          }));
        }
      }
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

    const ranked = rank(
      item.name,
      cards.slice(0, 12).map((card) => ({
        card,
        label: textOf(queryFirst(card, cfg.title)) || textOf(card),
      }))
    );

    const best = ranked[0];
    if (!best || best.score < MATCH_THRESHOLD) {
      return {
        ok: false,
        reason: 'no_match',
        message: `Aucun résultat convaincant pour « ${item.name} »`,
        bestLabel: best?.label ?? null,
        bestScore: best?.score ?? 0,
      };
    }

    // Deux candidats aussi plausibles l'un que l'autre : c'est à l'humain de
    // trancher. Choisir au hasard ferait entrer le mauvais format ou la
    // mauvaise variante sans que personne ne le voie.
    const second = ranked[1];
    if (
      second &&
      second.score >= MATCH_THRESHOLD &&
      best.score - second.score < AMBIGUITY_MARGIN &&
      best.extra === second.extra
    ) {
      return {
        ok: false,
        reason: 'ambiguous',
        message: `Plusieurs produits correspondent à « ${item.name} »`,
        candidates: ranked
          .slice(0, 3)
          .map((c) => ({ label: c.label.slice(0, 70), score: Number(c.score.toFixed(2)) })),
      };
    }

    const addBtn = queryFirstClickable(best.card, cfg.addButton);
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

    // Empreinte avant clic : sans cette vérification, un clic sans effet était
    // rapporté comme un ajout réussi et le panier restait vide.
    const before = fingerprint(best.card);
    const cartBefore = cartCount();

    addBtn.click();

    // L'interface met un instant à réagir ; on laisse jusqu'à 5 s.
    let changed = false;
    for (let waited = 0; waited < 5000; waited += 500) {
      await sleep(500);
      const cartAfter = cartCount();
      if (fingerprint(best.card) !== before) { changed = true; break; }
      if (cartBefore !== null && cartAfter !== null && cartAfter > cartBefore) {
        changed = true;
        break;
      }
    }

    if (!changed) {
      return {
        ok: false,
        reason: 'click_no_effect',
        message: `Clic sans effet sur « ${best.label} » — le panier n'a pas bougé`,
        button: addBtn.tagName.toLowerCase(),
        buttonLabel: textOf(addBtn).slice(0, 40) || addBtn.getAttribute('aria-label') || null,
      };
    }

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
