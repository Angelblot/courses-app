/**
 * Fiche produit : modifier à la main, actualiser depuis Open Food Facts,
 * supprimer. Logique pure, sans Supabase ni React Native.
 *
 * Un champ corrigé à la main est retenu dans `champs_manuels` : une
 * actualisation le montre, mais ne le coche pas, pour ne jamais défaire
 * silencieusement une correction du foyer.
 */
import type { FicheProduit } from './openfoodfacts.ts';
import { libelleRayon, rayonDepuisLibelle } from './rayons.ts';

/** Champs qu'on modifie à la main ou qu'Open Food Facts peut actualiser. */
export type ChampFiche = 'name' | 'brand' | 'contenance' | 'category' | 'nutriscore' | 'image_url';

export type ValeursFiche = {
  name: string;
  brand: string | null;
  grammage_g: number | null;
  volume_ml: number | null;
  category: string | null;
  nutriscore: string | null;
  image_url: string | null;
};

/** « 200 g », « 1,5 L », « 75 cl », ou null. */
export function formaterContenance(v: { grammage_g: number | null; volume_ml: number | null }): string | null {
  if (v.grammage_g != null) return v.grammage_g >= 1000 ? `${String(v.grammage_g / 1000).replace('.', ',')} kg` : `${v.grammage_g} g`;
  if (v.volume_ml != null) {
    if (v.volume_ml >= 1000) return `${String(v.volume_ml / 1000).replace('.', ',')} L`;
    if (v.volume_ml % 10 === 0) return `${v.volume_ml / 10} cl`;
    return `${v.volume_ml} ml`;
  }
  return null;
}

/**
 * Lit une contenance saisie à la main.
 *
 * @returns les deux colonnes (l'une nulle), `vide` pour un champ effacé, ou
 *   null si le texte ne se lit pas : l'écran le signale au lieu d'enregistrer.
 */
export function lireContenance(texte: string): { grammage_g: number | null; volume_ml: number | null } | null {
  const t = texte.trim().toLowerCase().replace(',', '.').replace(/\s+/g, '');
  if (!t) return { grammage_g: null, volume_ml: null };
  const m = /^(\d+(?:\.\d+)?)(kg|g|l|cl|ml)$/.exec(t);
  if (!m) return null;
  const n = Number(m[1]);
  if (!(n > 0)) return null;
  const facteur = { kg: 1000, g: 1, l: 1000, cl: 10, ml: 1 }[m[2] as 'kg' | 'g' | 'l' | 'cl' | 'ml'];
  const valeur = Math.round(n * facteur);
  return m[2] === 'kg' || m[2] === 'g' ? { grammage_g: valeur, volume_ml: null } : { grammage_g: null, volume_ml: valeur };
}

/** Champs dont la valeur a changé entre deux états de la fiche. */
export function champsModifies(avant: ValeursFiche, apres: ValeursFiche): ChampFiche[] {
  const champs: ChampFiche[] = [];
  if (avant.name.trim() !== apres.name.trim()) champs.push('name');
  if ((avant.brand ?? '') !== (apres.brand ?? '')) champs.push('brand');
  if (avant.grammage_g !== apres.grammage_g || avant.volume_ml !== apres.volume_ml) champs.push('contenance');
  if (rayonDepuisLibelle(avant.category) !== rayonDepuisLibelle(apres.category)) champs.push('category');
  if ((avant.nutriscore ?? null) !== (apres.nutriscore ?? null)) champs.push('nutriscore');
  if ((avant.image_url ?? null) !== (apres.image_url ?? null)) champs.push('image_url');
  return champs;
}

/** Ajoute des champs à la liste des corrections manuelles, sans doublon. */
export const fusionnerManuels = (actuels: readonly string[] | null | undefined, nouveaux: readonly ChampFiche[]) =>
  [...new Set([...(actuels ?? []), ...nouveaux])].sort();

export type Difference = {
  champ: ChampFiche;
  libelle: string;
  avant: string | null;
  apres: string | null;
  /** Corrigé à la main, ou photo améliorée : montré, pas coché. */
  protege: boolean;
  /** Pourquoi ce champ est protégé, à afficher sous la ligne. */
  raison?: string;
};

/**
 * Ce qu'une actualisation Open Food Facts changerait sur la fiche.
 *
 * Seules les valeurs qu'Open Food Facts connaît comptent : une marque ou une
 * note absentes de sa fiche n'effacent pas celles du catalogue.
 */
export function differencesOff(
  produit: ValeursFiche & { champs_manuels?: readonly string[] | null; image_originale?: string | null },
  off: FicheProduit,
): Difference[] {
  const manuels = new Set(produit.champs_manuels ?? []);
  const diffs: Difference[] = [];
  const ajouter = (champ: ChampFiche, libelle: string, avant: string | null, apres: string | null, protegeAutre?: string) => {
    if (apres == null || apres === '' || avant === apres) return;
    const raison = manuels.has(champ) ? 'Corrigé à la main' : protegeAutre;
    diffs.push({ champ, libelle, avant, apres, protege: !!raison, ...(raison ? { raison } : {}) });
  };
  ajouter('name', 'Nom', produit.name.trim(), off.name.trim());
  ajouter('brand', 'Marque', produit.brand, off.brand);
  ajouter('contenance', 'Contenance', formaterContenance(produit), formaterContenance({ grammage_g: off.grammageG, volume_ml: off.volumeMl }));
  if (off.categoryKey && off.categoryKey !== 'autre') {
    ajouter('category', 'Rayon', libelleRayon(rayonDepuisLibelle(produit.category)), libelleRayon(off.categoryKey));
  }
  ajouter('nutriscore', 'Nutriscore', produit.nutriscore?.toUpperCase() ?? null, off.nutriscore?.toUpperCase() ?? null);
  ajouter('image_url', 'Photo', produit.image_url, off.imageUrl, produit.image_originale ? 'Ta photo améliorée est gardée' : undefined);
  return diffs;
}

/** Colonnes à écrire pour les différences retenues. */
export function patchDepuisOff(off: FicheProduit, retenus: readonly ChampFiche[]): Partial<ValeursFiche> {
  const p: Partial<ValeursFiche> = {};
  for (const c of retenus) {
    if (c === 'name') p.name = off.name.trim();
    else if (c === 'brand') p.brand = off.brand;
    else if (c === 'contenance') { p.grammage_g = off.grammageG; p.volume_ml = off.volumeMl; }
    else if (c === 'category' && off.categoryKey) p.category = off.categoryKey;
    else if (c === 'nutriscore') p.nutriscore = off.nutriscore;
    else if (c === 'image_url') p.image_url = off.imageUrl;
  }
  return p;
}

export type Dependances = {
  correspondances: number; achats: number; recettes: number;
  /** Nom de la référence dont ce produit est une alternative, s'il en est une. */
  alternativeDe: string | null;
};

/** Ce qui part avec le produit, ligne par ligne, pour la feuille de suppression. */
export function pertesSuppression(d: Dependances): { pertes: string[]; garde: string | null } {
  const pertes: string[] = [];
  if (d.correspondances > 0) pertes.push(d.correspondances > 1 ? 'ses correspondances Carrefour et Leclerc' : 'sa correspondance drive');
  if (d.achats > 0) pertes.push(`son historique : ${d.achats} achat${d.achats > 1 ? 's' : ''}`);
  if (d.alternativeDe) pertes.push(`sa place parmi les alternatives de « ${d.alternativeDe} »`);
  const garde = d.recettes > 0
    ? `${d.recettes > 1 ? `Les ${d.recettes} recettes qui l’utilisent gardent` : 'La recette qui l’utilise garde'} l’ingrédient, sans produit associé.`
    : null;
  return { pertes, garde };
}
