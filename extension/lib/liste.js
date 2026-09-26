/**
 * Analyse de la liste saisie à la main.
 *
 * Extrait de popup.js pour que les tests portent sur le code qui s'exécute, et
 * non sur une copie. La duplication précédente n'avait pas encore divergé —
 * vérifié le 22/08 — mais rien ne l'en empêchait.
 *
 * Ce module ne touche ni à `chrome.*` ni au DOM : il reste exécutable sous
 * Node, ce qui est toute la raison de son existence.
 */

/**
 * Analyse la liste saisie à la main.
 *
 * Une ligne peut être :
 *   - un nom de produit, quantité optionnelle en suffixe « x2 » ;
 *   - une URL de fiche produit, qui court-circuite la recherche et donc toute
 *     ambiguïté entre produits aux noms voisins.
 *
 * @param {string} raw Texte brut du champ.
 * @returns {Array<{name: string, quantity: number, url?: string, ean?: string}>}
 */
export function parseItems(raw) {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)\s*[x×]\s*(\d+)$/i);
      let body = m ? m[1].trim() : line;
      const quantity = m ? Number(m[2]) : 1;

      // Préfixe [EAN13] posé par l'application : identifiant certain du produit.
      let ean = null;
      const tagged = body.match(/^\[(\d{13})\]\s*(.*)$/);
      if (tagged) {
        ean = tagged[1];
        body = tagged[2].trim();
      }

      if (/^https?:\/\//i.test(body)) {
        // Le nom lisible est déduit du segment d'URL, l'EAN de son suffixe.
        const slug = body.split('/').filter(Boolean).pop() ?? body;
        const eanFromSlug = slug.match(/(\d{13})/)?.[1] ?? null;
        const name = slug
          .replace(/-?\d{13}.*$/, '')
          .replace(/-/g, ' ')
          .trim();
        return { name: name || body, quantity, url: body, ean: ean ?? eanFromSlug };
      }
      return ean ? { name: body, quantity, ean } : { name: body, quantity };
    });
}
