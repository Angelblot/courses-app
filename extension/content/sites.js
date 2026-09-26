/**
 * Configuration par enseigne.
 *
 * ATTENTION — `productUrlPattern` est une **chaîne**, pas une expression
 * régulière. Cet objet traverse `chrome.scripting.executeScript`, dont les
 * arguments sont sérialisés en JSON : une RegExp y devient un objet vide, et
 * tout appel à `.test()` dans la page lève une exception. Le motif est donc
 * recompilé côté page. `hostPattern` et `storePathPattern`, qui ne servent que
 * dans le service worker et le popup, restent de vraies RegExp.
 *
 * Les sélecteurs sont donnés en listes de candidats, essayés dans l'ordre :
 * les sites de drive changent souvent de DOM et beaucoup de classes CSS sont
 * générées à la compilation (donc instables entre deux déploiements). Un
 * candidat qui échoue n'est pas une erreur, c'est le suivant qui prend.
 *
 * Ces listes n'ont pas pu être validées automatiquement : les deux enseignes
 * refusent l'accès programmatique. Elles se calibrent au premier passage réel
 * via le mode diagnostic (voir README).
 */

export const SITES = {
  carrefour: {
    label: 'Carrefour',
    origin: 'https://www.carrefour.fr',
    hostPattern: /(^|\.)carrefour\.fr$/,
    // Recherche produit. {q} est remplacé par la requête encodée.
    searchUrl: 'https://www.carrefour.fr/s?q={q}',
    // Bannière cookies — on refuse (choix le plus protecteur).
    cookieReject: [
      '#onetrust-reject-all-handler',
      "button:has-text('Continuer sans accepter')",
      "button:has-text('Tout refuser')",
      '[data-testid="cookie-reject"]',
    ],
    // Conteneurs de résultats.
    // Calibré le 18/08/2026 sur deux rapports de diagnostic réels.
    // article[class*="product"] renvoie exactement le nombre de produits
    // (30 sur « Mes achats fréquents »), là où li[class*="product-list"]
    // en compte 31 — un conteneur parasite s'y glisse.
    cards: [
      'article[class*="product"]',
      '[data-testid="product-card"]',
      'li[class*="product-list"]',
      '.product-card',
      '.ds-product-card',
    ],
    // Titre du produit, cherché à l'intérieur d'une carte.
    // Ordre conservé : il produit de bons titres sur une vraie page produit
    // (« LUSTUCRU / Pâtes Fraîches Tortellini Jambon Cru LUSTUCRU »).
    // a[href*="/p/"] reste en dernier recours : une carte contient environ
    // deux liens produit (image + titre), on risquerait de lire celui de
    // l'image, sans texte.
    title: [
      '[data-testid="product-title"]',
      '.product-card__title',
      'h3',
      'h2',
      'a[href*="/p/"]',
    ],
    price: ['[data-testid="product-price"]', '[class*="price"]', '.product-price'],
    // Bouton d'ajout au panier, à l'intérieur d'une carte.
    // Le libellé réel du bouton est « Acheter », pas « Ajouter ».
    // .add-to-cart passe en dernier : il compte une occurrence par carte, mais
    // un clic dessus reste sans effet — c'est le conteneur, pas le bouton.
    // On vise donc d'abord un vrai <button>, par son texte ou son aria-label.
    addButton: [
      "button:has-text('Acheter')",
      'button[aria-label*="cheter"]',
      'button[aria-label*="jouter"]',
      '.add-to-cart button',
      'button.add-to-cart',
      '[data-testid="add-to-cart"]',
      "button:has-text('Ajouter')",
      '.add-to-cart',
    ],
    // Fiche produit : l'accès direct évite toute recherche, donc toute
    // ambiguïté. La recherche par code-barres, elle, ne donne rien — Carrefour
    // n'indexe pas les EAN (vérifié le 18/08/2026, 0 résultat).
    productUrlPattern: '\\/p\\/[^/?#]*?-(\\d{13})(?:[/?#]|$)',
    // Le segment de l'URL est décoratif : seul l'EAN identifie la fiche
    // (vérifié le 18/08/2026, /p/x-<ean> ouvre bien le bon produit). On peut
    // donc atteindre n'importe quel produit du catalogue sans passer par la
    // recherche, dès lors qu'on connaît son code-barres.
    productUrlTemplate: 'https://www.carrefour.fr/p/x-{ean}',
    productPage: {
      addButton: [
        "button:has-text('Ajouter au panier')",
        'button[aria-label*="jouter au panier"]',
        "button:has-text('Ajouter')",
        '[data-testid="add-to-cart"]',
      ],
      title: ['h1'],
      price: ['[data-testid="product-price"]', '[class*="price"]'],
    },
    // Indices d'un challenge anti-bot ou d'une déconnexion.
    challengeHints: ['un instant', 'formalité', 'vous êtes un humain', 'captcha'],
    loginHints: ['se connecter', 'connexion', 'identifiez-vous'],
  },

  leclerc: {
    label: 'E.Leclerc Drive',
    origin: 'https://www.leclercdrive.fr',
    // Chaque magasin a son sous-domaine (fd10-courses.leclercdrive.fr…), donc
    // aucune origine ne peut être codée en dur : on part de l'onglet courant.
    hostPattern: /(^|\.)leclercdrive\.fr$|(^|\.)leclerc$/,
    searchUrl: 'https://www.leclercdrive.fr/recherche.aspx?TexteRecherche={q}',
    // Chemin confirmé par un diagnostic réel le 18/08/2026, sur
    // fd3-courses.leclercdrive.fr/magasin-093401-093401-Le-Cres-Montpellier/
    searchPath: '/recherche.aspx?TexteRecherche={q}',
    storePathPattern: /^\/magasin-[^/]+/,
    cookieReject: [
      "button:has-text('Continuer sans accepter')",
      "button:has-text('Tout refuser')",
      '#popin_tc_privacy_button_2',
      "button:has-text('Refuser')",
    ],
    // Calibré le 18/08/2026 sur fd3-courses.leclercdrive.fr.
    // Site ASP.NET WebForms : les classes s'écrivent liWCRS310_Product, avec
    // une majuscule. Les sélecteurs d'attribut CSS étant sensibles à la casse,
    // [class*="product"] ne matchait rien — d'où les zéros du premier rapport.
    cards: [
      'li[class*="WCRS310_Product"]',
      'li[class*="_Product"]',
      '[data-testid="product"]',
      'article[class*="roduct"]',
      '.product-item',
    ],
    title: [
      'a[class*="WCRS310_Product"]',
      'a[class*="_Product"]',
      '.product-title',
      'h3',
      'h2',
    ],
    price: ['[class*="Prix"]', '[class*="price"]', '[class*="prix"]'],
    // Le contrôle d'ajout est un <a href="#"> de classe aWCRS310_Add.
    //
    // La classe exacte est indispensable : aWCRS310_Add2List (« Ajouter à mes
    // listes ») contient la même sous-chaîne, et [class*="Panier"] remonte
    // 50 éléments dont un div conteneur — le piège déjà rencontré avec
    // .add-to-cart chez Carrefour, où le clic partait dans le vide.
    addButton: [
      'a.aWCRS310_Add',
      "a:has-text('Ajouter au panier')",
      'a[title*="jouter au panier"]',
      '[data-testid="add-to-cart"]',
    ],
    // Incrément de quantité propre au site (href="#plus").
    quantityPlus: ['a.aWCRS310_More', 'a[href="#plus"]'],
    // Les liens produit de la liste de résultats n'ont pas de href : la
    // navigation est pilotée en JavaScript. Aucun EAN n'est donc lisible dans
    // l'adresse, contrairement à Carrefour — l'accès direct par code-barres
    // n'est pas possible ici, et la recherche par nom reste la seule voie.
    productUrlPattern: '-(\\d{13})(?:[/?#]|$)',
    productPage: {
      addButton: ["a:has-text('Ajouter au panier')", "button:has-text('Ajouter')"],
      title: ['h1'],
      price: ['[class*="Prix"]', '[class*="price"]'],
    },
    challengeHints: ['un instant', 'formalité', 'vous êtes un humain', 'captcha'],
    loginHints: ['se connecter', 'connexion', 'identifiez-vous'],
  },
};

export const SITE_KEYS = Object.keys(SITES);
