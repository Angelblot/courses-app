import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retenirFrequent, suggestionsFrequentes } from './extras-frequents.ts';
test('un extra noté plusieurs fois remonte, sans doublon de casse ni d’accent',()=>{
 let f={};
 f=retenirFrequent(f,{name:'Pain'});f=retenirFrequent(f,{name:'pain '});f=retenirFrequent(f,{name:'Café',productId:'cafe'});
 assert.deepEqual(suggestionsFrequentes(f,[]).map(s=>s.name),['Pain','Café']);
 assert.equal(f.pain.count,2);assert.equal(f.cafe.productId,'cafe');
});
test('les suggestions écartent ce qui est déjà dans la liste et se limitent',()=>{
 let f={};for(const n of ['Pain','Lait','Café','Beurre','Sucre'])f=retenirFrequent(f,{name:n});
 const s=suggestionsFrequentes(f,['lait'],3).map(s=>s.name);
 assert.equal(s.length,3);assert.ok(!s.includes('Lait'));
});
test('un nom vide n’est pas retenu',()=>{assert.deepEqual(retenirFrequent({},{name:'  '}),{});});
