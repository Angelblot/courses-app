/**
 * Configuration par enseigne.
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
    cards: [
      '[data-testid="product-card"]',
      'article[class*="product"]',
      'li[class*="product-list"]',
      '.product-card',
      '.ds-product-card',
    ],
    // Titre du produit, cherché à l'intérieur d'une carte.
    title: [
      '[data-testid="product-title"]',
      '.product-card__title',
      'h3',
      'h2',
      'a[href*="/p/"]',
    ],
    price: ['[data-testid="product-price"]', '[class*="price"]', '.product-price'],
    // Bouton d'ajout au panier, à l'intérieur d'une carte.
    addButton: [
      '[data-testid="add-to-cart"]',
      'button[aria-label*="jouter"]',
      "button:has-text('Ajouter')",
      '.add-to-cart',
    ],
    // Indices d'un challenge anti-bot ou d'une déconnexion.
    challengeHints: ['un instant', 'formalité', 'vous êtes un humain', 'captcha'],
    loginHints: ['se connecter', 'connexion', 'identifiez-vous'],
  },

  leclerc: {
    label: 'E.Leclerc Drive',
    origin: 'https://www.leclercdrive.fr',
    searchUrl: 'https://www.leclercdrive.fr/recherche.aspx?TexteRecherche={q}',
    cookieReject: [
      "button:has-text('Continuer sans accepter')",
      "button:has-text('Tout refuser')",
      '#popin_tc_privacy_button_2',
      "button:has-text('Refuser')",
    ],
    cards: [
      '[data-testid="product"]',
      'article[class*="product"]',
      '.product-item',
      '.prd-item',
      'div[class*="product-card"]',
    ],
    title: ['.product-title', '.prd-title', 'h3', 'h2', 'a[href*="-fiche-produit"]'],
    price: ['[class*="price"]', '[class*="prix"]'],
    addButton: [
      "button:has-text('Ajouter')",
      '[data-testid="add-to-cart"]',
      'button[aria-label*="jouter"]',
      '.btn-add',
    ],
    challengeHints: ['un instant', 'formalité', 'vous êtes un humain', 'captcha'],
    loginHints: ['se connecter', 'connexion', 'identifiez-vous'],
  },
};

export const SITE_KEYS = Object.keys(SITES);
