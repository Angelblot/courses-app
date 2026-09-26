import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importerAjouts, widgetProducts } from './widget-products.ts';
const id='11111111-1111-4111-8111-111111111111';
const state={quotidien:{},quotidienQty:{},ligneQuantites:{},lignePossedees:{},extras:[],selectedRecipes:{},choixProduits:{},drives:[]};
const receipt={id:'receipt-1',name:'Lait',quantity:1,source:'widget',productID:id,createdAt:'2026-09-12'};
const product={id,name:'Lait',favorite:true,volume_ml:1000,unit:'unité',image_url:'https://example.com/milk.png'};
test('widget addition retains product ID and replay never doubles quantity',()=>{
 const added=importerAjouts(state,[receipt]);
 assert.equal(added.quotidien[id],'needed');assert.equal(added.extras.length,0);
 assert.equal(added.quotidienQty[id],1);assert.equal(importerAjouts(added,[receipt]),added);
 const stale=importerAjouts({...state,quotidien:{[id]:'needed'},quotidienQty:{[id]:4}},[receipt]);
 assert.equal(stale.quotidienQty[id],4);
});
test('widget reactivates owned/zero quantity product and Siri remains free text',()=>{
 const added=importerAjouts({...state,lignePossedees:{[`produit:${id}`]:true},ligneQuantites:{[`produit:${id}`]:0}},[receipt]);
 assert.equal(added.lignePossedees[`produit:${id}`],false);assert.equal(added.ligneQuantites[`produit:${id}`],undefined);
 const siri=importerAjouts(state,[{...receipt,productID:undefined,source:'siri'}]);assert.equal(siri.extras[0].name,'Lait');
});
test('snapshot reflects favourites and consolidated recipe needs',()=>{
 const recipe={id:'meal',name:'Crêpes',ingredients:[{name:'Lait',product_id:id,quantity_per_serving:250,unit:'ml',rayon:'cremerie'}]};
 const snapshot=widgetProducts({...state,selectedRecipes:{meal:2}},[product,{...product,id:'other',favorite:false}],[recipe]);
 assert.equal(snapshot.length,1);assert.equal(snapshot[0].inList,true);assert.equal(snapshot[0].detail,'1 L');
 assert.equal(widgetProducts({...state,quotidien:{[id]:'have'}},[product],[])[0].inList,false);
});
