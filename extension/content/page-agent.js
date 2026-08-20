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

  // Recompilé ici : les arguments d'executeScript sont sérialisés en JSON, une
  // RegExp transmise depuis le service worker arriverait vide.
  const productUrlRe = cfg.productUrlPattern ? new RegExp(cfg.productUrlPattern) : null;

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
   * Un sélecteur peut désigner le conteneur de la carte plutôt que son contrôle
   * d'ajout : le clic part alors dans le vide et l'ajout échoue en silence.
   * On exige donc un élément visible, actif, et de nature cliquable — <button>,
   * mais aussi <a> ou <input>, car les sites anciens comme le drive Leclerc
   * n'utilisent pas de <button> pour ajouter au panier.
   */
  function queryFirstClickable(root, selectors) {
    const CLICKABLE_TAGS = new Set(['BUTTON', 'A', 'INPUT']);
    for (const sel of selectors) {
      for (const el of queryAll(root, sel)) {
        const clickable =
          CLICKABLE_TAGS.has(el.tagName) ||
          el.getAttribute('role') === 'button' ||
          el.hasAttribute('onclick');
        if (clickable && isVisible(el) && !el.disabled) return el;
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
      // Sépare chiffres et lettres : « 500g » et « 500 g » désignent le même
      // grammage, mais donnaient deux mots différents et faisaient échouer la
      // correspondance sur un simple détail de typographie.
      .replace(/(\d)([a-z])/g, '$1 $2')
      .replace(/([a-z])(\d)/g, '$1 $2')
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
   * Nombre de résultats examinés. Large à dessein : quand une marque manque des
   * premiers titres, elle se trouve souvent plus bas dans la liste.
   */
  const MAX_CANDIDATES = 30;

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
   *
   * Les termes qu'aucun résultat ne porte sont retirés de la recherche. Une
   * marque absente du rayon — « Lardons fumés Herta » dans un drive qui ne
   * vend que du Tradilège — condamnait sinon toute la liste, alors que le
   * moteur du site avait déjà fait le tri. Ces termes écartés sont signalés :
   * le produit retenu est alors approchant, et l'utilisateur doit le savoir.
   *
   * @returns {{ranked: Array, ignored: string[]}}
   */
  function rank(wanted, candidates) {
    const tokens = normalize(wanted)
      .split(' ')
      .filter((t) => t && !STOP_WORDS.has(t));
    const corpus = candidates.map((c) => normalize(c.label)).join(' ');
    const matched = tokens.filter((t) => corpus.includes(t));
    const missing = tokens.filter((t) => !corpus.includes(t));

    // On ne peut écarter que des qualificatifs, jamais le produit lui-même.
    // Le premier mot significatif d'une recherche de courses en est le nom :
    // « Jambon blanc Herta » demande du jambon, « Saumon fumé Labeyrie » du
    // saumon. S'il figure dans les résultats, écarter le reste est légitime —
    // le rayon ne référence simplement pas cette marque ou cette précision.
    // S'il en est absent, aucun repli n'est acceptable : sans cette règle,
    // « Saumon fumé Labeyrie » ne gardait que « fumé » et faisait entrer des
    // lardons dans le panier.
    const head = tokens[0];
    const keep = Boolean(head) && corpus.includes(head);

    const effective = keep && matched.length ? matched.join(' ') : wanted;
    const ignored = keep ? missing : [];

    const ranked = candidates
      .map((c) => ({
        ...c,
        score: score(effective, c.label),
        extra: extraTokens(effective, c.label),
      }))
      .sort(
        (a, b) =>
          b.score - a.score || a.extra - b.extra || a.label.length - b.label.length
      );

    return { ranked, ignored };
  }

  /**
   * Code EAN13 contenu dans une URL de fiche produit.
   * Carrefour n'indexe pas les EAN dans sa recherche, mais les expose dans
   * l'adresse : c'est ce qui permet de vérifier une correspondance, et surtout
   * de revenir directement au bon produit la fois suivante.
   */
  function eanFromUrl(url) {
    if (!productUrlRe) return null;
    const m = (url || '').match(productUrlRe);
    return m ? m[1] : null;
  }

  /** Ajoute au panier depuis une fiche produit (pas une liste de résultats). */
  async function addFromProductPage() {
    const pp = cfg.productPage || {};
    const label = textOf(queryFirst(document, pp.title || ['h1']));
    const ean = eanFromUrl(location.href);

    // Si l'on attendait un produit précis, on refuse tout écart.
    if (item.ean && ean && item.ean !== ean) {
      return {
        ok: false,
        reason: 'wrong_product',
        message: `La fiche ouverte ne correspond pas (${ean} au lieu de ${item.ean})`,
        label,
      };
    }

    const btn = queryFirstClickable(document, pp.addButton || []);
    if (!btn) {
      // Sans titre ni bouton, la fiche n'existe pas ou le produit n'est pas
      // proposé par ce drive : l'orchestrateur retentera par la recherche.
      const body = textOf(document.body).toLowerCase();
      const absent =
        !label ||
        body.includes('page introuvable') ||
        body.includes('indisponible') ||
        body.includes("n'existe plus");
      return {
        ok: false,
        reason: absent ? 'product_unavailable' : 'no_add_button',
        message: absent
          ? 'Fiche introuvable ou produit non proposé par ce drive'
          : "Bouton d'ajout introuvable",
        label,
      };
    }

    btn.scrollIntoView({ block: 'center' });
    await sleep(300);
    const before = fingerprint(document.body);
    const cartBefore = cartCount();
    btn.click();

    let changed = false;
    for (let waited = 0; waited < 5000; waited += 500) {
      await sleep(500);
      const cartAfter = cartCount();
      if (fingerprint(document.body) !== before) { changed = true; break; }
      if (cartBefore !== null && cartAfter !== null && cartAfter > cartBefore) { changed = true; break; }
    }

    if (!changed) {
      return { ok: false, reason: 'click_no_effect', message: `Clic sans effet sur « ${label} »`, label };
    }

    return {
      ok: true,
      reason: 'added',
      label,
      ean,
      url: location.href,
      via: 'product_page',
      price: textOf(queryFirst(document, pp.price || [])).slice(0, 30) || null,
    };
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
      // Sans cette mention, un diagnostic lancé avec la mauvaise enseigne
      // renvoie des zéros indiscernables d'une page non reconnue.
      enseigne: cfg.label,
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
      // Tous les éléments actionnables de la carte, quel que soit leur type :
      // sur les sites anciens, l'ajout au panier est souvent un <a>.
      const cliquables = [...card.querySelectorAll('a, button, input, [onclick], [role="button"]')]
        .slice(0, 10)
        .map((e) => ({
          tag: e.tagName.toLowerCase(),
          cls: (e.className || '').toString().slice(0, 45),
          txt: textOf(e).slice(0, 25),
          title: e.getAttribute('title')?.slice(0, 30) ?? null,
          href: e.getAttribute('href')?.slice(0, 45) ?? null,
        }));

      return {
        cardText: textOf(card).replace(/\s+/g, ' ').slice(0, 120),
        titles,
        buttons,
        cliquables,
        link: card.querySelector('a')?.getAttribute('href')?.slice(0, 80) ?? null,
      };
    });

    // Repli utile quand aucun sélecteur de carte ne marche : les liens produit.
    report.productLinks = document.querySelectorAll('a[href*="/p/"], a[href*="fiche-produit"]').length;
    report.isSearchPage = /[?&]q=/.test(location.search) || /recherche/.test(location.pathname);

    // Quand rien ne correspond, décrire la page telle qu'elle est plutôt que de
    // répéter des zéros : le contenu peut vivre dans une iframe, ou porter des
    // classes qu'on n'a pas devinées.
    if (!cardSelector) {
      const classCount = {};
      for (const el of document.querySelectorAll('[class]')) {
        for (const c of el.classList) {
          if (/prod|item|article|result|card|tuile|vignette/i.test(c)) {
            classCount[c] = (classCount[c] || 0) + 1;
          }
        }
      }
      const topClasses = Object.entries(classCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([c, n]) => `${c} (${n})`);

      const hrefs = [...document.querySelectorAll('a[href]')]
        .map((a) => a.getAttribute('href'))
        .filter((h) => h && !h.startsWith('#') && !/^javascript:/i.test(h));

      report.exploration = {
        cadre: window === window.top ? 'principal' : 'iframe',
        urlCadre: location.href.slice(0, 120),
        iframes: document.querySelectorAll('iframe, frame').length,
        elements: document.querySelectorAll('*').length,
        liens: hrefs.length,
        boutons: document.querySelectorAll('button, input[type="button"], input[type="submit"]').length,
        images: document.querySelectorAll('img').length,
        classesProbables: topClasses,
        exemplesLiens: [...new Set(hrefs)].slice(0, 8).map((h) => h.slice(0, 90)),
      };
    }
    return report;
  }

  /**
   * Ajoute au panier depuis une carte de résultats, en vérifiant l'effet.
   *
   * @param {{card: Element, label: string, href: string, ean: ?string, score: number}} choice
   */
  async function addToCart(choice) {
    const addBtn = queryFirstClickable(choice.card, cfg.addButton);
    if (!addBtn) {
      return {
        ok: false,
        reason: 'no_add_button',
        message: `Bouton d'ajout introuvable pour « ${choice.label} »`,
      };
    }

    addBtn.scrollIntoView({ block: 'center' });
    await sleep(300);

    // Empreinte avant clic : sans cette vérification, un clic sans effet était
    // rapporté comme un ajout réussi et le panier restait vide.
    const before = fingerprint(choice.card);
    const cartBefore = cartCount();
    addBtn.click();

    let changed = false;
    for (let waited = 0; waited < 5000; waited += 500) {
      await sleep(500);
      const cartAfter = cartCount();
      if (fingerprint(choice.card) !== before) { changed = true; break; }
      if (cartBefore !== null && cartAfter !== null && cartAfter > cartBefore) {
        changed = true;
        break;
      }
    }

    if (!changed) {
      return {
        ok: false,
        reason: 'click_no_effect',
        message: `Clic sans effet sur « ${choice.label} » — le panier n'a pas bougé`,
        button: addBtn.tagName.toLowerCase(),
        buttonLabel: textOf(addBtn).slice(0, 40) || addBtn.getAttribute('aria-label') || null,
      };
    }

    // Quantité > 1 : cliquer le « + » autant que nécessaire.
    const wanted = Math.max(1, Math.round(Number(item.quantity) || 1));
    let added = 1;
    if (wanted > 1) {
      const plus = queryFirstClickable(choice.card, cfg.quantityPlus ?? [
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

    return {
      ok: true,
      reason: 'added',
      label: choice.label,
      // Renvoyés pour alimenter la table des correspondances : la prochaine
      // fois, on ira droit à cette fiche au lieu de rechercher.
      ean: choice.ean ?? null,
      url: choice.href ? new URL(choice.href, location.origin).href : null,
      score: Number((choice.score ?? 1).toFixed(2)),
      quantityAdded: added,
      quantityWanted: wanted,
      price: textOf(queryFirst(choice.card, cfg.price)).slice(0, 30) || null,
    };
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

    // Accès direct à une fiche : aucune recherche, donc aucune ambiguïté.
    if (productUrlRe && productUrlRe.test(location.href)) {
      return addFromProductPage();
    }

    const { selector: cardSelector, elements: cards } = await waitForCards();
    if (!cards.length) {
      return {
        ok: false,
        reason: 'no_results',
        message: 'Aucune carte produit reconnue',
        diagnostic: diagnose(),
      };
    }

    // Choix explicite de l'utilisateur après une ambiguïté : on cible le
    // libellé retenu et on n'évalue plus rien — il n'y a plus rien à décider.
    if (item.exactLabel) {
      const flatten = (t) => t.replace(/\s+/g, ' ').trim();
      const wanted = flatten(item.exactLabel);
      const target = cards
        .map((card) => ({ card, label: textOf(queryFirst(card, cfg.title)) || textOf(card) }))
        .find((c) => flatten(c.label) === wanted);

      if (!target) {
        return {
          ok: false,
          reason: 'candidate_gone',
          message: `« ${item.exactLabel} » n'est plus dans les résultats`,
        };
      }
      const added = await addToCart(target);
      return added.ok ? { ...added, via: 'chosen' } : added;
    }

    const { ranked, ignored } = rank(
      item.name,
      cards.slice(0, MAX_CANDIDATES).map((card) => {
        // Les ancres internes (« # », « #plus ») ne désignent aucun produit :
        // chez Leclerc, les liens produit n'ont d'ailleurs pas de href du tout.
        const href =
          [...card.querySelectorAll('a[href]')]
            .map((a) => a.getAttribute('href'))
            .find((h) => h && !h.startsWith('#')) ?? '';
        return {
          card,
          label: textOf(queryFirst(card, cfg.title)) || textOf(card),
          href,
          ean: eanFromUrl(href),
        };
      })
    );

    // Un EAN connu tranche sans discussion : c'est le même produit, quel que
    // soit le libellé affiché. On court-circuite alors tout le scoring textuel.
    if (item.ean) {
      const exact = ranked.find((c) => c.ean && c.ean === item.ean);
      if (exact) {
        const added = await addToCart(exact);
        return added.ok ? { ...added, via: 'ean_match', certain: true } : added;
      }
    }

    const best = ranked[0];
    if (!best || best.score < MATCH_THRESHOLD) {
      return {
        ok: false,
        reason: 'no_match',
        message: `Aucun résultat convaincant pour « ${item.name} »`,
        bestLabel: best?.label ?? null,
        bestScore: best?.score ?? 0,
        ignored,
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
        ignored,
      };
    }

    const added = await addToCart(best);
    // Des termes écartés signifient un produit approchant, pas exact : c'est à
    // signaler, sans quoi l'utilisateur croirait avoir eu ce qu'il demandait.
    return added.ok && ignored.length ? { ...added, ignored, approximate: true } : added;
  })();
}
