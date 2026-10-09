/**
 * Remplacer un produit que l'extension n'a pas mis au panier : les offres
 * qu'elle a vues pendant le remplissage, des recherches plus courtes quand
 * rien ne convient, et la liste à renvoyer avec les seuls remplacements.
 * Logique pure, sans Supabase ni React Native.
 */
import { parleDe } from './affinage.ts';
import { requeteSansMarque } from './compte-rendu.ts';
import type { ItemPanier } from './consolidation.ts';
import { rayonDepuisLibelle } from './rayons.ts';

/** Ce qu'on retient d'un remplacement choisi, de quoi le renvoyer à l'extension. */
export type Remplacement = {
  product_id: string; nom: string; ean13: string | null; prix: number | null; image_url: string | null;
  grammage_g: number | null; volume_ml: number | null; category: string | null;
};
/** Par drive, par nom de produit non ajouté. */
export type Remplacements = Record<string, Record<string, Remplacement>>;

type OffreVue = { libelle: string; recherche?: string | null; drive: string; rang: number | null; ean13: string | null; prix: number | null };

/**
 * Les offres vues pour ce produit sur ce drive, et qui en parlent vraiment :
 * pour « Ail blanc 1p », la page ne montrait que des piquets de tente.
 */
export function offresPertinentes<O extends OffreVue>(offres: O[], nom: string, drive: string, recherches: string[] = [nom]): O[] {
  // Le mot principal (« ail », « crème ») doit y être : un mot d'à côté (« blanc ») ne suffit pas.
  const tete = requeteSansMarque(nom).replace(/\S*\d\S*/g, ' ').split(/\s+/).find(m => m.length >= 3) ?? nom;
  const vus = new Set<string>();
  return offres
    .filter(o => o.drive === drive && recherches.includes(o.recherche ?? '') && parleDe(o.libelle, tete))
    .sort((a, b) => (a.rang ?? 99) - (b.rang ?? 99))
    .filter(o => { const k = o.ean13 ?? o.libelle.toLowerCase(); if (vus.has(k)) return false; vus.add(k); return true; });
}

/** Des recherches plus courtes que le nom : « Ail blanc 1p » donne « ail blanc », puis « ail ». */
export function recherchesPlusCourtes(nom: string): string[] {
  const mots = requeteSansMarque(nom).toLowerCase().replace(/[-–·,()]/g, ' ').split(/\s+/)
    .filter(m => m && !/\d/.test(m) && !['de', 'du', 'des', 'la', 'le', 'les', 'à', 'au', 'aux', 'et', 'en'].includes(m));
  const out = [mots.slice(0, 3).join(' '), mots.slice(0, 2).join(' '), mots[0] ?? ''].filter(q => q.length >= 3);
  return [...new Set(out)].filter(q => q !== nom.toLowerCase());
}

export type Origine = { quantity?: number; grammage_g?: number | null; volume_ml?: number | null };

/**
 * Combien de remplaçants pour la quantité d'origine : 2 crèmes de 25 cl
 * remplacées par une de 50 cl, c'est une seule. Sans contenance connue des
 * deux côtés, on garde le nombre d'origine.
 */
export function quantiteRemplacement(o: Origine | undefined, r: Pick<Remplacement, 'grammage_g' | 'volume_ml'>): number {
  const q = Math.max(1, o?.quantity ?? 1);
  const avant = o?.grammage_g ?? o?.volume_ml, apres = o?.grammage_g != null ? r.grammage_g : r.volume_ml;
  if (!avant || !apres) return q;
  return Math.max(1, Math.ceil((q * avant) / apres - 1e-9));
}

/** La liste à renvoyer : les seuls remplacements de ce drive, dans la quantité d'origine ajustée au format. */
export function itemsDesRemplacements(r: Record<string, Remplacement> | undefined, origines: Record<string, Origine>): ItemPanier[] {
  return Object.entries(r ?? {}).map(([item, x]) => ({
    name: x.nom, quantity: quantiteRemplacement(origines[item], x), unit: 'unité', ean13: x.ean13,
    category: rayonDepuisLibelle(x.category) ?? 'autre', product_id: x.product_id,
    grammage_g: x.grammage_g, volume_ml: x.volume_ml,
  }));
}
