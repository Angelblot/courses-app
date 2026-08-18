/**
 * Met une liste consolidée au format attendu par l'extension navigateur
 * (voir extension/README.md) : un produit par ligne, quantité en suffixe « xN ».
 *
 * Seules les quantités entières deviennent un multiplicateur d'article. Une
 * quantité en grammes ou en litres décrit une contenance, pas un nombre
 * d'articles à mettre dans le panier : la convertir en « x400 » ferait ajouter
 * 400 fois le produit.
 *
 * @param {Array<{name: string, quantity: number, unit: string}>} items
 * @returns {string} Liste prête à coller dans l'extension.
 */
export function toExtensionList(items) {
  const COUNTABLE = new Set(['piece', 'pièce', 'pieces', 'pièces', 'unité', 'unite', 'u', '']);

  return items
    .map((item) => {
      const unit = (item.unit || '').toLowerCase().trim();
      const qty = Number(item.quantity);
      const isCountable = COUNTABLE.has(unit);
      const n = Math.round(qty);
      if (isCountable && Number.isFinite(qty) && n > 1) return `${item.name} x${n}`;
      return item.name;
    })
    .join('\n');
}
