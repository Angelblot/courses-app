import { useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { useWizard } from './WizardContext';
import { useProducts } from '../stores/products';
import { useRecipes } from '../stores/recipes';
import { listeMaison } from '../lib/liste-maison';
export function useMaison(){
 const w=useWizard(),p=useProducts(),r=useRecipes();
 useFocusEffect(useCallback(()=>{p.recharger();r.recharger();},[p.recharger,r.recharger]));
 const lignes=useMemo(()=>listeMaison(w,r.recettes,p.produits),[w,r.recettes,p.produits]);
 const erreur=p.erreur||r.erreur; const loading=p.chargement||r.chargement;
 const stale=Object.keys(w.selectedRecipes).some(id=>!r.recettes.some(rec=>rec.id===id));
 return {w,p,r,lignes,loading,erreur,stale,acheter:lignes.filter(l=>!l.owned)};
}
