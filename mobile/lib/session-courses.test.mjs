import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manquesDuBrouillon, manquesAPreciser, doublonsPossibles, instantaneHabitude, restaurerHabitude, resumeBilan, lignesSimilaires, abandonner, cleDistinct, etapeDeReprise } from './session-courses.ts';
import { listeMaison } from './liste-maison.ts';
import { importerAjouts } from './widget-products.ts';
const base={selectedRecipes:{},quotidien:{},quotidienQty:{},extras:[],choixProduits:{},drives:[],ligneQuantites:{},lignePossedees:{}};
const p={id:'11111111-1111-4111-8111-111111111111',name:'Pommes de terre',unit:'unité',grammage_g:1000,ean13:'1234567890123',category:'fruits_legumes'};
test('migration garde les manques historiques sans inventer une provenance widget',()=>{
 const e={...base,quotidien:{p:'needed',h:'needed'},habitudesVues:{h:true},extras:[{id:'siri-a',name:'Pain',quantity:1}]};
 assert.deepEqual(Object.keys(manquesDuBrouillon(e)),['produit:p','extra:siri-a']);
 assert.equal(manquesDuBrouillon(e)['produit:p'].source,'precedent');
 assert.deepEqual(manquesAPreciser({...e,ligneQuantites:{'produit:p':0}},[]).map(([k])=>k),['extra:siri-a']);
});
test('un produit du catalogue arrivé par le widget est prêt sans validation',()=>{
 const key=`produit:${p.id}`,e={...base,sessionEtape:'recap',manques:{[key]:{name:p.name,source:'widget',valide:true}}};
 const next=importerAjouts(e,[{id:'new',name:p.name,source:'widget',productID:p.id,quantity:1,createdAt:'2026-09-14'}]);
 assert.equal(next.sessionEtape,'recap');assert.equal(manquesAPreciser(next,[p.id]).length,0);
});
test('seuls un libellé libre et un produit sorti du catalogue restent à préciser',()=>{
 const e={...base,quotidien:{ok:'needed',parti:'needed'},manques:{'produit:ok':{name:'Œufs',source:'widget'},'produit:parti':{name:'Lait',source:'siri'},'extra:x':{name:'lessive',source:'manuel'}},extras:[{id:'x',name:'lessive',quantity:1}]};
 assert.deepEqual(manquesAPreciser(e,['ok']).map(([k])=>k),['produit:parti','extra:x']);
 const valide={...e,manques:{...e.manques,'extra:x':{name:'lessive',source:'manuel',valide:true}}};
 assert.deepEqual(manquesAPreciser(valide,['ok']).map(([k])=>k),['produit:parti']);
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
 assert.equal(manquesAPreciser(e,[]).length,0);
});
test('retirer une ligne fusionnée ne fait pas réapparaître son ajout manuel',()=>{
 const e={...base,quotidien:{[p.id]:'needed'},extras:[{id:'x',name:p.name,quantity:1,unit:'unité',rayon:'fruits_legumes'}]};
 const lines=listeMaison(e,[],[p]);assert.equal(lines.length,1);
 assert.deepEqual(listeMaison({...e,ligneQuantites:{[lines[0].key]:0}},[],[p]),[]);
});
test('annuler une décision Habitudes rend exactement l’état d’avant',()=>{
 const e={...base,quotidien:{o:'needed'},quotidienQty:{o:3},habitudesVues:{}};
 const avant=instantaneHabitude(e,'o');
 const apres={...e,habitudesVues:{o:true},quotidien:{o:'have'},quotidienQty:{o:1},ligneQuantites:{'produit:o':1},lignePossedees:{'produit:o':true}};
 assert.deepEqual(restaurerHabitude(apres,'o',avant),{...e,habitudesVues:{}});
});
test('le résumé du bilan compte repas, manques, habitudes et extras',()=>{
 const e={...base,selectedRecipes:{a:2,b:4},quotidien:{m:'needed',h:'needed',x:'have'},habitudesVues:{h:true,x:true},manques:{'produit:m':{name:'M',source:'widget'},'extra:s':{name:'S',source:'siri'}},extras:[{id:'s',name:'S',quantity:1},{id:'z',name:'Z',quantity:1}]};
 assert.deepEqual(resumeBilan(e),['2 repas','2 manques','1 habitude','1 extra']);
 assert.deepEqual(resumeBilan(base),[]);
});
test('le résumé du bilan ignore les lignes retirées ou déjà possédées',()=>{
 const e={...base,manques:{},quotidien:{h:'needed'},habitudesVues:{h:true},extras:[{id:'z',name:'Z',quantity:1},{id:'y',name:'Y',quantity:1}],ligneQuantites:{'extra:z':0},lignePossedees:{'produit:h':true}};
 assert.deepEqual(resumeBilan(e),['1 extra']);
});
test('une ligne proche est retrouvée pendant la saisie d’un extra',()=>{
 const l=(key,name,owned=false)=>({key,name,owned,unit:'unité',totalQuantity:2,sources:[],rayon:'autre',product_id:null,ean13:null,aPreciser:false,candidats:[]});
 const lignes=[l('produit:p','Pommes de terre'),l('produit:o','Oignons jaunes'),l('extra:x','Pommes de terre nouvelles',true)];
 assert.deepEqual(lignesSimilaires('Pommes de terre bio',lignes).map(x=>x.key),['produit:p']);
 assert.deepEqual(lignesSimilaires('oignon',lignes).map(x=>x.key),['produit:o']);
 assert.deepEqual(lignesSimilaires('Lait',lignes),[]);
 assert.deepEqual(lignesSimilaires('po',lignes),[]);
});
test('abandonner des courses garde les manques notés et efface le reste',()=>{
 const e={...base,sessionEtape:'recap',selectedRecipes:{r:2},quotidien:{m:'needed',h:'needed'},quotidienQty:{m:2,h:1},habitudesVues:{h:true},
  manques:{'produit:m':{name:'M',source:'widget',valide:true},'extra:s':{name:'S',source:'siri'}},extras:[{id:'s',name:'S',quantity:1},{id:'z',name:'Z',quantity:1}],
  ligneQuantites:{'produit:h':3},lignePossedees:{'produit:m':false},doublonsValides:['d'],importsExternes:['i'],extrasFrequents:{z:{name:'Z',count:2}},drives:['leclerc'],choixProduits:{g:'p'}};
 const a=abandonner(e);
 assert.equal(a.sessionEtape,undefined);
 assert.deepEqual(a.selectedRecipes,{});assert.deepEqual(a.quotidien,{m:'needed'});assert.deepEqual(a.quotidienQty,{m:2});
 assert.deepEqual(a.extras.map(x=>x.id),['s']);assert.deepEqual(Object.keys(a.manques),['produit:m','extra:s']);
 assert.deepEqual([a.habitudesVues,a.ligneQuantites,a.lignePossedees,a.doublonsValides,a.choixProduits],[{},{},{},[],{}]);
 assert.deepEqual([a.importsExternes,a.extrasFrequents,a.drives],[['i'],{z:{name:'Z',count:2}},['leclerc']]);
});
test('un produit noté « à part » ne revient pas comme doublon, même si les quantités changent',()=>{
 const e={...base,quotidien:{[p.id]:'needed'},extras:[{id:'x',name:'Pommes de terre bio',quantity:1,unit:'unité',rayon:'fruits_legumes'}]};
 const lines=listeMaison(e,[],[p]);
 assert.equal(doublonsPossibles(lines,[],[cleDistinct('Pommes de terre','Pommes de terre bio')]).length,0);
 assert.equal(doublonsPossibles(lines.map(l=>({...l,totalQuantity:l.totalQuantity+3})),[],[cleDistinct('pommes de terre bio','POMMES DE TERRE')]).length,0);
 assert.equal(doublonsPossibles(lines,[],[]).length,1);
});
test('un brouillon arrêté sur une ancienne étape reprend au bilan',()=>{
 assert.equal(etapeDeReprise('recettes'),'recettes');assert.equal(etapeDeReprise('recap'),'recap');
 for(const v of ['manques','habitudes','exceptions'])assert.equal(etapeDeReprise(v),'recap');
 assert.equal(etapeDeReprise(undefined),undefined);assert.equal(etapeDeReprise('inconnue'),undefined);
});
