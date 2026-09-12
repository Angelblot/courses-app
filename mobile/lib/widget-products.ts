import type { Etat } from '../contexts/WizardContext';
import type { Product } from '../stores/products';
import type { Recipe } from '../stores/recipes';
import { nouveauxAjouts } from './ajouts-quotidiens.ts';
import { listeMaison } from './liste-maison.ts';

export function widgetProducts(state: Etat, products: Product[], recipes: Recipe[]) {
  const inList = new Set(listeMaison(state, recipes, products).filter(l => !l.owned).map(l => l.product_id));
  return products.filter(p => p.favorite).map(p => ({
    id: p.id, name: p.name, imageURL: p.image_url, inList: inList.has(p.id),
    detail: p.volume_ml ? (p.volume_ml >= 1000 ? `${p.volume_ml / 1000} L` : `${p.volume_ml} ml`)
      : p.grammage_g ? (p.grammage_g >= 1000 ? `${p.grammage_g / 1000} kg` : `${p.grammage_g} g`)
      : p.unit || '1 article',
  }));
}

/** Widget receipts keep the catalogue ID; Siri's free text remains an extra. */
export function importerAjouts(state: Etat, pending: unknown): Etat {
  const items = nouveauxAjouts(pending, state.importsExternes ?? []);
  if (!items.length) return state;
  const next = { ...state, quotidien: {...state.quotidien}, quotidienQty: {...state.quotidienQty},
    lignePossedees: {...state.lignePossedees}, ligneQuantites: {...state.ligneQuantites}, extras: [...state.extras],
    importsExternes: [...(state.importsExternes ?? []), ...items.map(x => x.id)] };
  for (const item of items) {
    if (item.productID) {
      const id = item.productID;
      // An add from a stale widget must not double an item added in the app meanwhile.
      next.quotidien[id] = 'needed';
      next.quotidienQty[id] = Math.max(state.quotidienQty[id] ?? 0, item.quantity);
      next.lignePossedees[`produit:${id}`] = false;
      if (next.ligneQuantites[`produit:${id}`] === 0) delete next.ligneQuantites[`produit:${id}`];
    } else next.extras.push({ id: `siri-${item.id}`, name: item.name, quantity: item.quantity, unit: 'unité', rayon: 'autre' });
  }
  return next;
}
