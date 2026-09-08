import type { Etat } from '../contexts/WizardContext';
import type { Product } from '../stores/products';
import type { Recipe } from '../stores/recipes';
import type { LigneConsolidee } from './consolidation.ts';
import { normalizeProductType } from './typology.ts';
import { quantiteNormalisee, convertToProductQty } from './unites.ts';
import { rayonDepuisLibelle } from './rayons.ts';
export type LigneMaison = LigneConsolidee & { owned: boolean; aPreciser: boolean; choixKey?: string; candidats: Product[]; besoin?: string };
export function listeMaison(e: Etat, recettes: Recipe[], produits: Product[]): LigneMaison[] {
  const lignes = new Map<string, LigneMaison>();
  const groupes = new Map<string, { nom: string; qty: number; unit: string; candidats: Product[]; sources: LigneConsolidee['sources']; rayon: string }>();
  for (const recette of recettes) {
    const parts = e.selectedRecipes[recette.id];
    if (!parts || parts < 1) continue;
    for (const ing of recette.ingredients) {
      const q = ing.quantity_per_serving * parts;
      const normal = quantiteNormalisee(q, ing.unit);
      const type = normalizeProductType(ing.name);
      const unit = normal?.famille ?? ing.unit;
      const key = `${type ?? ing.name.trim().toLowerCase()}::${unit}`;
      const candidats = produits.filter(p => p.id === ing.product_id || (type && p.product_type === type) || p.name.toLowerCase() === ing.name.toLowerCase());
      // Une liaison explicite est prioritaire sur une simple ressemblance de nom.
      candidats.sort((a,b) => Number(b.id === ing.product_id) - Number(a.id === ing.product_id));
      let g = groupes.get(key);
      if (!g) { g = { nom: ing.name, qty: 0, unit, candidats, sources: [], rayon: ing.rayon }; groupes.set(key,g); }
      g.qty += normal?.valeur ?? q;
      g.sources.push({ type: 'recipe', label: recette.name, qty: q });
    }
  }
  for (const [choixKey,g] of groupes) {
    const id = e.choixProduits[choixKey];
    const produit = id ? produits.find(p=>p.id===id) : g.candidats[0];
    const conversion = produit ? convertToProductQty(g.qty,g.unit,produit) : null;
    const valide = conversion && conversion.qty > 0;
    const key = produit ? `produit:${produit.id}` : `ingredient:${choixKey}`;
    const besoin = `${g.qty.toLocaleString('fr-FR')} ${g.unit} pour les recettes`;
    const ligne: LigneMaison = { key, choixKey, name: produit?.name ?? g.nom, unit: produit?.unit ?? g.unit,
      totalQuantity: valide ? conversion.qty : g.unit === 'unité' ? g.qty : 1,
      product_id: produit?.id ?? null, ean13: produit?.ean13 ?? null,
      rayon: rayonDepuisLibelle(produit?.category ?? g.rayon), sources: g.sources,
      owned: !!produit && e.quotidien[produit.id] === 'have',
      aPreciser: !valide && g.unit !== 'unité', candidats: g.candidats, besoin,
    };
    const existante = lignes.get(key);
    if (existante) { existante.totalQuantity += ligne.totalQuantity; existante.sources.push(...ligne.sources); existante.aPreciser ||= ligne.aPreciser; }
    else lignes.set(key,ligne);
  }
  for (const [id,statut] of Object.entries(e.quotidien)) {
    const p = produits.find(p=>p.id===id); if (!p) continue;
    const key = `produit:${id}`, qty = e.quotidienQty[id] ?? 1;
    const existante = lignes.get(key);
    if (existante) { if (statut === 'have') existante.owned = true;
      else existante.totalQuantity = Math.max(existante.totalQuantity,qty);
      continue;
    }
    lignes.set(key,{key,name:p.name,unit:p.unit,totalQuantity:qty,product_id:id,ean13:p.ean13,rayon:rayonDepuisLibelle(p.category),sources:[{type:'quotidien',label:'Favoris',qty}],owned:statut==='have',aPreciser:false,candidats:[]});
  }
  for (const extra of e.extras) {
    const key = `extra:${extra.id}`;
    lignes.set(key,{key,name:extra.name,unit:extra.unit,totalQuantity:extra.quantity,product_id:null,ean13:null,rayon:extra.rayon,sources:[{type:'extra',label:'Ajout manuel',qty:extra.quantity}],owned:false,aPreciser:false,candidats:[]});
  }
  return [...lignes.values()].map(l=>{
    const q = e.ligneQuantites?.[l.key];
    return {...l, totalQuantity:q ?? l.totalQuantity, owned:e.lignePossedees?.[l.key] ?? l.owned,
      // Une quantité explicitement confirmée est le nombre de conditionnements à acheter.
      unit:q != null && l.aPreciser ? 'unité' : l.unit,
      aPreciser:q == null && l.aPreciser};
  }).filter(l=>l.totalQuantity>0).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
}
