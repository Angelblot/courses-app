import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lireAjouts,nouveauxAjouts,nombreArticles} from './ajouts-quotidiens.ts';
const item={id:'abc',name:' Lait ',quantity:2,source:'siri',createdAt:'2026-09-08'};
test('valide les données Siri avant entrée dans la liste',()=>{
 assert.deepEqual(lireAjouts([item,{...item,quantity:0},{...item,quantity:1.5},{...item,name:''},null]),[{...item,name:'Lait'}]);
 assert.deepEqual(lireAjouts({items:[item]}),[]);
});
test('un import rejoué ou dupliqué n’ajoute pas deux fois le manque',()=>{
 assert.equal(nouveauxAjouts([item,item],[]).length,1);
 assert.equal(nouveauxAjouts([item],['abc']).length,0);
 assert.equal(nouveauxAjouts([item,{...item,id:'autre'}],['abc']).length,1);
});
test('quantités bornées pour une décision au swipe',()=>{
 assert.equal(nombreArticles(0),1);assert.equal(nombreArticles(500),99);assert.equal(nombreArticles(2.7),3);
});
