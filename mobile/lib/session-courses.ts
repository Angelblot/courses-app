import type { Etat } from '../contexts/WizardContext';
import type { LigneMaison } from './liste-maison';
import { normalizeProductType } from './typology.ts';

/**
 * La session tient en deux étapes : choisir les repas, puis le bilan, qui
 * intègre déjà manques et habitudes. Manques, Habitudes et Extras ne sont
 * plus des étapes imposées : ce sont des corrections ouvertes depuis le bilan.
 */
export const SESSION_STEPS = [
 { cle: 'recettes', label: 'Repas' }, { cle: 'recap', label: 'Bilan' },
] as const;
export type SessionStep = typeof SESSION_STEPS[number]['cle'];
export const CORRECTIONS = [
 { cle: 'manques', label: 'Manques' }, { cle: 'habitudes', label: 'Habitudes' }, { cle: 'exceptions', label: 'Extras' },
] as const;
export type Correction = typeof CORRECTIONS[number]['cle'];
/** Les brouillons d'avant la refonte ont pu s'arrêter sur une correction : on reprend au bilan. */
export function etapeDeReprise(v: string | undefined): SessionStep | undefined {
 if (v === 'recettes' || v === 'recap') return v;
 return CORRECTIONS.some(c => c.cle === v) ? 'recap' : undefined;
}
export type Manque = { name: string; source: 'widget' | 'siri' | 'rappels' | 'manuel' | 'precedent'; valide?: boolean };
export const normaliserNom = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g,'oe').replace(/[^a-z0-9]+/g,' ').trim();

/** Old drafts did not retain the source. Keep them, without inventing a widget origin. */
export function manquesDuBrouillon(e: Etat): Record<string, Manque> {
 if (e.manques) return e.manques;
 const result: Record<string, Manque> = {};
 for (const [id, status] of Object.entries(e.quotidien))
  if (status === 'needed' && !e.habitudesVues?.[id]) result[`produit:${id}`] = { name: 'Produit enregistré', source: 'precedent' };
 for (const x of e.extras) result[`extra:${x.id}`] = { name: x.name, source: x.id.startsWith('siri-') ? 'siri' : x.id.startsWith('rappel-') ? 'rappels' : 'precedent' };
 return result;
}
export function manqueActif(e: Etat, key: string) {
 if (e.lignePossedees[key] || e.ligneQuantites[key] === 0) return false;
 return key.startsWith('produit:') ? e.quotidien[key.slice(8)] === 'needed' : e.extras.some(x=>`extra:${x.id}`===key);
}
/**
 * Manques qui demandent un geste avant l'envoi au drive. Un produit du
 * catalogue est prêt d'office, d'où qu'il vienne : seuls un libellé libre
 * et un produit sorti du catalogue restent à préciser.
 */
export function manquesAPreciser(e: Etat, produitIds: Iterable<string>) {
 const catalogue = new Set(produitIds);
 return Object.entries(manquesDuBrouillon(e)).filter(([key,m])=>manqueActif(e,key)&&!m.valide&&!(key.startsWith('produit:')&&catalogue.has(key.slice(8))));
}
/** Clé d'une paire de produits déclarés distincts, indépendante des quantités. */
export const cleDistinct = (a: string, b: string) => [normaliserNom(a), normaliserNom(b)].sort().join('|');
/**
 * Paires qui se ressemblent. `acceptes` retient une paire tranchée au bilan
 * (et redemande si les quantités bougent) ; `distincts` retient une paire
 * déclarée distincte dès la saisie, par ses noms seulement.
 */
export function doublonsPossibles(lignes: LigneMaison[], acceptes: string[] = [], distincts: string[] = []) {
 const actifs=lignes.filter(l=>!l.owned), result: {id:string;a:LigneMaison;b:LigneMaison}[]=[];
 for(let i=0;i<actifs.length;i++) for(let j=i+1;j<actifs.length;j++) {
  const a=actifs[i],b=actifs[j],na=normaliserNom(a.name),nb=normaliserNom(b.name);
  const ta=normalizeProductType(a.name,null,{repli:false}),tb=normalizeProductType(b.name,null,{repli:false});
  if (!(a.ean13&&a.ean13===b.ean13) && na!==nb && !(ta&&ta===tb)) continue;
  if (distincts.includes(cleDistinct(a.name,b.name))) continue;
  const id=[a,b].map(l=>`${l.key}:${l.totalQuantity}:${l.name}:${l.unit}`).sort().join('|');
  if(!acceptes.includes(id)) result.push({id,a,b});
 }
 return result;
}

/** Ce qu'une décision Habitudes change dans le brouillon, pour pouvoir l'annuler. */
export type InstantaneHabitude = { vue?: boolean; statut?: 'needed' | 'have'; qty?: number; ligneQty?: number; possedee?: boolean };
export function instantaneHabitude(e: Etat, id: string): InstantaneHabitude {
 const key = `produit:${id}`;
 return { vue: e.habitudesVues?.[id], statut: e.quotidien[id], qty: e.quotidienQty[id], ligneQty: e.ligneQuantites[key], possedee: e.lignePossedees[key] };
}
function poser<T>(table: Record<string, T> | undefined, key: string, valeur: T | undefined): Record<string, T> {
 const suite = { ...table };
 if (valeur === undefined) delete suite[key]; else suite[key] = valeur;
 return suite;
}
export function restaurerHabitude(e: Etat, id: string, avant: InstantaneHabitude): Etat {
 const key = `produit:${id}`;
 return { ...e,
  habitudesVues: poser(e.habitudesVues, id, avant.vue), quotidien: poser(e.quotidien, id, avant.statut), quotidienQty: poser(e.quotidienQty, id, avant.qty),
  ligneQuantites: poser(e.ligneQuantites, key, avant.ligneQty), lignePossedees: poser(e.lignePossedees, key, avant.possedee) };
}

/** D'où viennent les courses, pour l'en-tête du bilan : « 2 repas », « 3 manques »… */
export function resumeBilan(e: Etat): string[] {
 const manques = Object.keys(manquesDuBrouillon(e)).filter(key => manqueActif(e, key));
 const retenue = (key: string) => e.ligneQuantites[key] !== 0 && !e.lignePossedees[key];
 const habitudes = Object.keys(e.habitudesVues ?? {}).filter(id => e.habitudesVues?.[id] && e.quotidien[id] === 'needed' && retenue(`produit:${id}`) && !manques.includes(`produit:${id}`));
 const extras = e.extras.filter(x => retenue(`extra:${x.id}`) && !manques.includes(`extra:${x.id}`));
 const parts: [number, string, string][] = [[Object.keys(e.selectedRecipes).length, 'repas', 'repas'], [manques.length, 'manque', 'manques'], [habitudes.length, 'habitude', 'habitudes'], [extras.length, 'extra', 'extras']];
 return parts.filter(([n]) => n > 0).map(([n, un, plusieurs]) => `${n} ${n > 1 ? plusieurs : un}`);
}

/**
 * Lignes de la liste qui ressemblent à un nom en cours de saisie : même type
 * de produit, ou un nom contenu dans l'autre. Montrées avant d'ajouter un
 * extra, pour ajuster la ligne existante au lieu de créer un doublon.
 */
export function lignesSimilaires(nom: string, lignes: LigneMaison[]): LigneMaison[] {
 const n = normaliserNom(nom);
 if (n.length < 3) return [];
 const type = normalizeProductType(nom);
 return lignes.filter(l => {
  if (l.owned) return false;
  const m = normaliserNom(l.name);
  return (type && normalizeProductType(l.name) === type) || m.includes(n) || n.includes(m);
 });
}

/**
 * Abandonne des courses en cours : les manques notés au fil des jours
 * restent, tout ce que la session a ajouté ou décidé disparaît.
 */
export function abandonner(e: Etat): Etat {
 const manques = Object.fromEntries(Object.entries(manquesDuBrouillon(e)).filter(([key]) => manqueActif(e, key)).map(([key, m]) => [key, { name: m.name, source: m.source }]));
 const produits = Object.keys(manques).filter(k => k.startsWith('produit:')).map(k => k.slice(8));
 const garder = <T,>(table: Record<string, T>) => Object.fromEntries(Object.entries(table).filter(([id]) => produits.includes(id)));
 return {
  manques, importsExternes: e.importsExternes, extrasFrequents: e.extrasFrequents, drives: e.drives,
  quotidien: garder(e.quotidien), quotidienQty: garder(e.quotidienQty),
  extras: e.extras.filter(x => `extra:${x.id}` in manques),
  selectedRecipes: {}, habitudesVues: {}, ligneQuantites: {}, lignePossedees: {}, doublonsValides: [], choixProduits: {}, ingredientsSansProduit: [], enPlus: {},
 };
}

/**
 * Produits du catalogue qui ressemblent à un libellé noté à la main : même
 * type de produit, ou un mot du libellé dans leur nom. Proposés d'emblée
 * pour préciser un manque en un tap.
 */
export function produitsProches<P extends { name: string; product_type?: string | null }>(nom: string, produits: P[], max = 5): P[] {
 const type = normalizeProductType(nom), mots = normaliserNom(nom).split(' ').filter(m => m.length >= 3);
 if (!mots.length && !type) return [];
 return produits.filter(p => {
  if (type && p.product_type === type) return true;
  const n = normaliserNom(p.name).split(' ');
  return mots.some(m => n.some(x => x.startsWith(m) || m.startsWith(x) && x.length >= 4));
 }).slice(0, max);
}

/**
 * Défait le règlement d'un manque (« Changer » dans Préciser) : remet, depuis
 * l'état d'avant, les seules clés que `validerManque` a touchées pour ce
 * point. Ce qui a été réglé depuis sur d'autres points reste en place.
 */
export function rouvrirManque(e: Etat, avant: Etat, key: string, productId?: string): Etat {
 const cible = productId ? `produit:${productId}` : key;
 const remettre = <T,>(table: Record<string, T>, source: Record<string, T>, cles: string[]) => {
  const t = { ...table };
  for (const k of cles) { if (k in source) t[k] = source[k]; else delete t[k]; }
  return t;
 };
 const lignes = [key, cible], ids = [productId, key.startsWith('produit:') ? key.slice(8) : null].filter((x): x is string => !!x);
 const extraAvant = avant.extras.find(x => `extra:${x.id}` === key);
 const extras = key.startsWith('extra:')
  ? extraAvant ? [...e.extras.filter(x => x.id !== extraAvant.id), extraAvant] : e.extras.filter(x => `extra:${x.id}` !== key)
  : e.extras;
 return {
  ...e,
  manques: remettre(manquesDuBrouillon(e), manquesDuBrouillon(avant), lignes),
  quotidien: remettre(e.quotidien, avant.quotidien, ids),
  quotidienQty: remettre(e.quotidienQty, avant.quotidienQty, ids),
  ligneQuantites: remettre(e.ligneQuantites, avant.ligneQuantites, lignes),
  lignePossedees: remettre(e.lignePossedees, avant.lignePossedees, lignes),
  extras,
 };
}
