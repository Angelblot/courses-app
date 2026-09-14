import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manquesDuBrouillon, manquesAValider, doublonsPossibles } from './session-courses.ts';
import { listeMaison } from './liste-maison.ts';
import { importerAjouts } from './widget-products.ts';
const base={selectedRecipes:{},quotidien:{},quotidienQty:{},extras:[],choixProduits:{},drives:[],ligneQuantites:{},lignePossedees:{}};
const p={id:'11111111-1111-4111-8111-111111111111',name:'Pommes de terre',unit:'unité',grammage_g:1000,ean13:'1234567890123',category:'fruits_legumes'};
test('migration garde les manques historiques sans inventer une provenance widget',()=>{
 const e={...base,quotidien:{p:'needed',h:'needed'},habitudesVues:{h:true},extras:[{id:'siri-a',name:'Pain',quantity:1}]};
 assert.deepEqual(Object.keys(manquesDuBrouillon(e)),['produit:p','extra:siri-a']);
 assert.equal(manquesDuBrouillon(e)['produit:p'].source,'precedent');
 assert.equal(manquesAValider({...e,ligneQuantites:{'produit:p':0}}).length,1);
});
test('une arrivée widget pendant la session demande une nouvelle validation sans perdre les autres',()=>{
 const key=`produit:${p.id}`,e={...base,sessionEtape:'recap',manques:{[key]:{name:p.name,source:'widget',valide:true}}};
 const next=importerAjouts(e,[{id:'new',name:p.name,source:'widget',productID:p.id,quantity:1,createdAt:'2026-09-14'}]);
 assert.equal(next.sessionEtape,'recap');assert.equal(manquesAValider(next).length,1);
});
test('recette, widget et ajout au même nom ne créent qu’une ligne avec toutes les origines',()=>{
 const e={...base,selectedRecipes:{r:2},quotidien:{[p.id]:'needed'},quotidienQty:{[p.id]:2},manques:{[`produit:${p.id}`]:{name:p.name,source:'widget'}},extras:[{id:'x',name:'  Pommes de terre ',quantity:1,unit:'unité',rayon:'fruits_legumes'}]};
 const recettes=[{id:'r',name:'Gratin',ingredients:[{name:p.name,product_id:p.id,unit:'g',quantity_per_serving:300,rayon:'fruits_legumes'}]}];
 const lines=listeMaison(e,recettes,[p]);assert.equal(lines.length,1);assert.equal(lines[0].totalQuantity,2);
 assert.deepEqual(lines[0].sources.map(s=>s.label),['Gratin','Widget','Ajout manuel']);
});
test('les formats différents restent distincts et les doublons possibles nécessitent une décision',()=>{
 const e={...base,quotidien:{[p.id]:'needed'},extras:[{id:'x',name:'Pommes de terre bio',quantity:500,unit:'g',rayon:'fruits_legumes'}]};
 const lines=listeMaison(e,[],[p]),pairs=doublonsPossibles(lines);assert.equal(lines.length,2);assert.equal(pairs.length,1);
 assert.equal(doublonsPossibles(lines,[pairs[0].id]).length,0);
 assert.equal(doublonsPossibles(lines.map(l=>({...l,totalQuantity:l.totalQuantity+1})),[pairs[0].id]).length,1);
});
test('un manque déjà possédé ou retiré ne bloque pas la suite',()=>{
 const e={...base,quotidien:{p:'needed'},manques:{'produit:p':{name:'Pain',source:'widget'}},lignePossedees:{'produit:p':true}};
 assert.equal(manquesAValider(e).length,0);
});
test('retirer une ligne fusionnée ne fait pas réapparaître son ajout manuel',()=>{
 const e={...base,quotidien:{[p.id]:'needed'},extras:[{id:'x',name:p.name,quantity:1,unit:'unité',rayon:'fruits_legumes'}]};
 const lines=listeMaison(e,[],[p]);assert.equal(lines.length,1);
 assert.deepEqual(listeMaison({...e,ligneQuantites:{[lines[0].key]:0}},[],[p]),[]);
});
