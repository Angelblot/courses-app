import type { Etat } from '../contexts/WizardContext';
import type { LigneMaison } from './liste-maison';
import { normalizeProductType } from './typology.ts';

export const SESSION_STEPS = [
 { cle: 'recettes', label: 'Recettes' }, { cle: 'manques', label: 'Manques' },
 { cle: 'habitudes', label: 'Habitudes' }, { cle: 'exceptions', label: 'En plus' },
 { cle: 'recap', label: 'Bilan' },
] as const;
export type SessionStep = typeof SESSION_STEPS[number]['cle'];
export type Manque = { name: string; source: 'widget' | 'siri' | 'manuel' | 'precedent'; valide?: boolean };
export const normaliserNom = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g,'oe').replace(/[^a-z0-9]+/g,' ').trim();

/** Old drafts did not retain the source. Keep them, without inventing a widget origin. */
export function manquesDuBrouillon(e: Etat): Record<string, Manque> {
 if (e.manques) return e.manques;
 const result: Record<string, Manque> = {};
 for (const [id, status] of Object.entries(e.quotidien))
  if (status === 'needed' && !e.habitudesVues?.[id]) result[`produit:${id}`] = { name: 'Produit enregistré', source: 'precedent' };
 for (const x of e.extras) result[`extra:${x.id}`] = { name: x.name, source: x.id.startsWith('siri-') ? 'siri' : 'precedent' };
 return result;
}
export function manqueActif(e: Etat, key: string) {
 if (e.lignePossedees[key] || e.ligneQuantites[key] === 0) return false;
 return key.startsWith('produit:') ? e.quotidien[key.slice(8)] === 'needed' : e.extras.some(x=>`extra:${x.id}`===key);
}
export function manquesAValider(e: Etat) {
 return Object.entries(manquesDuBrouillon(e)).filter(([key,m])=>manqueActif(e,key)&&!m.valide);
}
export function doublonsPossibles(lignes: LigneMaison[], acceptes: string[] = []) {
 const actifs=lignes.filter(l=>!l.owned), result: {id:string;a:LigneMaison;b:LigneMaison}[]=[];
 for(let i=0;i<actifs.length;i++) for(let j=i+1;j<actifs.length;j++) {
  const a=actifs[i],b=actifs[j],na=normaliserNom(a.name),nb=normaliserNom(b.name);
  const ta=normalizeProductType(a.name),tb=normalizeProductType(b.name);
  if (!(a.ean13&&a.ean13===b.ean13) && na!==nb && !(ta&&ta===tb)) continue;
  const id=[a,b].map(l=>`${l.key}:${l.totalQuantity}:${l.name}:${l.unit}`).sort().join('|');
  if(!acceptes.includes(id)) result.push({id,a,b});
 }
 return result;
}
