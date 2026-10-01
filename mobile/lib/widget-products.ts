import { manquesDuBrouillon } from './session-courses.ts';
import type { Etat } from '../contexts/WizardContext';
import type { Product } from '../stores/products';
import type { Recipe } from '../stores/recipes';
import { nouveauxAjouts } from './ajouts-quotidiens.ts';
import { listeMaison } from './liste-maison.ts';
import { referencePourNom, references, type ProduitClasse } from './references.ts';

export function widgetProducts(state: Etat, products: Product[], recipes: Recipe[]) {
  const inList = new Set(listeMaison(state, recipes, products).filter(l => !l.owned).map(l => l.product_id));
  // Le widget propose les références : une alternative vit sous la sienne.
  return references(products).map(p => ({
    id: p.id, name: p.name, imageURL: p.image_url, inList: inList.has(p.id),
    // Siri reconnaît aussi le produit à ses phrases retenues et à son type.
    synonyms: [...new Set([...(p.phrases_siri ?? []), ...(p.product_type ? [p.product_type] : [])])],
    detail: p.volume_ml ? (p.volume_ml >= 1000 ? `${p.volume_ml / 1000} L` : `${p.volume_ml} ml`)
      : p.grammage_g ? (p.grammage_g >= 1000 ? `${p.grammage_g / 1000} kg` : `${p.grammage_g} g`)
      : p.unit || '1 article',
  }));
}

/** Widget receipts keep the catalogue ID; Siri's free text remains an extra. */
export function importerAjouts(state: Etat, pending: unknown): Etat {
  const items = nouveauxAjouts(pending, state.importsExternes ?? []);
  if (!items.length) return state;
  const next = { ...state, manques: {...manquesDuBrouillon(state)}, quotidien: {...state.quotidien}, quotidienQty: {...state.quotidienQty},
    lignePossedees: {...state.lignePossedees}, ligneQuantites: {...state.ligneQuantites}, extras: [...state.extras],
    importsExternes: [...(state.importsExternes ?? []), ...items.map(x => x.id)] };
  for (const item of items) {
    if (item.productID) {
      const id = item.productID;
      next.manques[`produit:${id}`] = {name:item.name,source:item.source === 'siri' ? 'siri' : 'widget',valide:false};
      // An add from a stale widget must not double an item added in the app meanwhile.
      next.quotidien[id] = 'needed';
      next.quotidienQty[id] = Math.max(state.quotidienQty[id] ?? 0, item.quantity);
      next.lignePossedees[`produit:${id}`] = false;
      if (next.ligneQuantites[`produit:${id}`] === 0) delete next.ligneQuantites[`produit:${id}`];
    } else {
      next.extras.push({ id: `siri-${item.id}`, name: item.name, quantity: item.quantity, unit: 'unité', rayon: 'autre' });
      next.manques[`extra:siri-${item.id}`] = {name:item.name,source:'siri',valide:false};
    }
  }
  return next;
}

/**
 * Un besoin dit à Siri (« papier toilette ») rejoint la référence de son
 * type : la ligne devient ce produit, avec ses alternatives. Ce qui ne
 * correspond à aucun type connu reste un libellé libre, à préciser.
 */
export function rattacherSiri(state: Etat, produits: ProduitClasse[]): Etat {
  let next: Etat | null = null;
  for (const [key, m] of Object.entries(state.manques ?? {})) {
    if (!(key.startsWith('extra:siri-') || key.startsWith('extra:rappel-')) || m.valide) continue;
    const ref = referencePourNom(m.name, produits);
    if (!ref) continue;
    const extra = state.extras.find(x => `extra:${x.id}` === key);
    next ??= { ...state, manques: { ...state.manques }, extras: [...state.extras], quotidien: { ...state.quotidien },
      quotidienQty: { ...state.quotidienQty }, lignePossedees: { ...state.lignePossedees }, ligneQuantites: { ...state.ligneQuantites } };
    const manques = next.manques!;
    delete manques[key];
    next.extras = next.extras.filter(x => `extra:${x.id}` !== key);
    const id = ref.id, cleProduit = `produit:${id}`;
    manques[cleProduit] = { name: ref.name, source: m.source, valide: false };
    // Le message de reprise suit la ligne jusqu'à son produit, pour « Annuler ».
    if (next.derniereReprise?.cles.includes(key)) next.derniereReprise = { ...next.derniereReprise, cles: next.derniereReprise.cles.map(c => c === key ? cleProduit : c) };
    next.quotidien[id] = 'needed';
    next.quotidienQty[id] = Math.max(state.quotidienQty[id] ?? 0, extra?.quantity ?? 1);
    next.lignePossedees[cleProduit] = false;
    if (next.ligneQuantites[cleProduit] === 0) delete next.ligneQuantites[cleProduit];
  }
  return next ?? state;
}
