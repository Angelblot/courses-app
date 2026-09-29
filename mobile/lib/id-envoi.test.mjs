import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelIdEnvoi } from './id-envoi.ts';
test('un identifiant d’envoi est un UUID v4, accepté par la colonne uuid de cart_jobs',()=>{
 for(let i=0;i<200;i++)assert.match(nouvelIdEnvoi(),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
test('deux identifiants ne se répètent pas',()=>{
 const vus=new Set();for(let i=0;i<5000;i++)vus.add(nouvelIdEnvoi());assert.equal(vus.size,5000);
});
