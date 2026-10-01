/**
 * Reprise d'une liste Rappels (variante RA1). Siri range « ajoute … à ma
 * liste de courses » dans Rappels : l'app reprend ces articles à chaque
 * ouverture, comme un ajout Siri, puis les coche dans Rappels.
 */
import { manquesDuBrouillon } from './session-courses.ts';
import type { Etat } from '../contexts/WizardContext';

export type ArticleRappel = { id: string; titre: string };
/** Ce qui vient d'être repris, pour le message et son « Annuler ». */
export type Reprise = { liste: string; ids: string[]; cles: string[]; vue?: boolean };

/** Les articles lus dans Rappels, validés : un titre non vide et raisonnable. */
export function lireArticles(brut: unknown): ArticleRappel[] {
 if (!Array.isArray(brut)) return [];
 return brut.filter((a): a is ArticleRappel => !!a && typeof a.id === 'string' && a.id.length > 0 && a.id.length < 200
  && typeof a.titre === 'string' && a.titre.trim().length > 0 && a.titre.length <= 120)
  .map(a => ({ id: a.id, titre: a.titre.trim() }));
}

/** « 2 laits », « Lait x2 », « Lait (2) » : la quantité notée, sinon 1. */
export function quantiteEtNom(titre: string): { name: string; quantity: number } {
 const t = titre.trim();
 const avant = t.match(/^(\d{1,2})\s+(?:x\s+|×\s+)?(.+)$/i);
 if (avant && +avant[1] >= 1) return { name: avant[2].trim(), quantity: Math.min(99, +avant[1]) };
 const apres = t.match(/^(.+?)\s*(?:[x×]\s*(\d{1,2})|\((\d{1,2})\))$/i);
 const n = apres ? +(apres[2] ?? apres[3]) : 0;
 if (apres && n >= 1) return { name: apres[1].trim(), quantity: Math.min(99, n) };
 return { name: t, quantity: 1 };
}

export const cleRappel = (id: string) => `rappel:${id}`;

/**
 * Ajoute les articles pas encore repris comme manques libres (source
 * « rappels ») ; le rattachement aux produits se fait ensuite, comme pour
 * Siri. Un article déjà repris ne revient jamais, même décoché dans Rappels.
 */
export function importerRappels(state: Etat, liste: string, articles: ArticleRappel[]): Etat {
 const deja = new Set(state.importsExternes ?? []);
 const nouveaux = articles.filter(a => !deja.has(cleRappel(a.id)));
 if (!nouveaux.length) return state;
 const manques = { ...manquesDuBrouillon(state) }, extras = [...state.extras];
 const cles: string[] = [];
 for (const a of nouveaux) {
  const { name, quantity } = quantiteEtNom(a.titre);
  const id = `rappel-${a.id}`.slice(0, 150);
  extras.push({ id, name, quantity, unit: 'unité', rayon: 'autre' });
  manques[`extra:${id}`] = { name, source: 'rappels', valide: false };
  cles.push(`extra:${id}`);
 }
 return { ...state, manques, extras,
  importsExternes: [...(state.importsExternes ?? []), ...nouveaux.map(a => cleRappel(a.id))],
  derniereReprise: { liste, ids: nouveaux.map(a => a.id), cles } };
}

/** Retire de la liste ce que la dernière reprise a apporté. Les articles restent connus : ils ne reviennent pas. */
export function annulerReprise(state: Etat): Etat {
 const r = state.derniereReprise;
 if (!r) return state;
 const cles = new Set(r.cles), manques = { ...manquesDuBrouillon(state) };
 const quotidien = { ...state.quotidien }, quotidienQty = { ...state.quotidienQty };
 for (const cle of cles) {
  delete manques[cle];
  if (cle.startsWith('produit:')) { delete quotidien[cle.slice(8)]; delete quotidienQty[cle.slice(8)]; }
 }
 return { ...state, manques, quotidien, quotidienQty, extras: state.extras.filter(x => !cles.has(`extra:${x.id}`)), derniereReprise: undefined };
}
