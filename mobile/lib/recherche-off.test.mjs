import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerRechercheParNom } from './openfoodfacts.ts';

const produit = { code: '1234567890123', product_name: 'Biscuits', brands: 'Test' };
const succes = () => Response.json({ products: [produit] });
const config = { pause: 0, delaiTentative: 100, budget: 500 };

test('503 puis succès : le même clic récupère les produits', async () => {
  let appels = 0; const etapes = [];
  const chercher = creerRechercheParNom({ ...config, requeteHttp: async () => ++appels === 1 ? new Response('', {status:503}) : succes() });
  const r = await chercher('biscuits', { onTentative: n => etapes.push(n) });
  assert.equal(r.etat, 'trouve'); assert.equal(r.fiches[0].ean13, produit.code);
  assert.deepEqual(etapes, [1,2]); assert.equal(appels, 2);
});

test('erreur réseau et réponse malformée sont reprises, pas confondues avec zéro résultat', async () => {
  let appels=0;
  const chercher=creerRechercheParNom({...config, requeteHttp:async()=>{
    appels++; if(appels===1)throw new TypeError('network'); if(appels===2)return Response.json({error:'maintenance'});return succes();
  }});
  assert.equal((await chercher('biscuits')).etat,'trouve'); assert.equal(appels,3);
});

test('les pannes sont bornées à trois essais et ne sont pas mises en cache', async () => {
  let appels=0;
  const chercher=creerRechercheParNom({...config,requeteHttp:async()=>{appels++;return new Response('',{status:502});}});
  assert.equal((await chercher('biscuits')).etat,'indisponible'); assert.equal(appels,3);
  await chercher('biscuits'); assert.equal(appels,6);
});

test('une réponse HTTP définitive ne provoque pas de rafale', async () => {
  let appels=0;const chercher=creerRechercheParNom({...config,requeteHttp:async()=>{appels++;return new Response('',{status:400});}});
  assert.equal((await chercher('biscuits')).etat,'indisponible');assert.equal(appels,1);
});

test('le cache normalise la saisie, expire et conserve aussi les recherches vides', async () => {
  let appels=0,temps=0;
  const chercher=creerRechercheParNom({...config,maintenant:()=>temps,requeteHttp:async()=>{appels++;return Response.json({products:[]});}});
  assert.equal((await chercher('  BISCUITS   lait ')).etat,'vide');
  await chercher('biscuits lait');assert.equal(appels,1);
  temps=300001;await chercher('biscuits lait');assert.equal(appels,2);
});

test('429 respecte Retry-After pour les recherches suivantes, même différentes', async () => {
  let appels=0,temps=100000;
  const chercher=creerRechercheParNom({...config,maintenant:()=>temps,requeteHttp:async()=>++appels===1?new Response('',{status:429,headers:{'Retry-After':'45'}}):succes()});
  const r=await chercher('biscuits');assert.equal(r.raison,'limite');assert.equal(r.reessayerDans,45);
  await chercher('lait');assert.equal(appels,1);
  temps+=45001;assert.equal((await chercher('lait')).etat,'trouve');assert.equal(appels,2);
});

test('Retry-After accepte une date HTTP et une limitation sans en-tête attend 60 secondes', async () => {
  const temps=Date.UTC(2026,8,24);
  for(const headers of [{'Retry-After':new Date(temps+60000).toUTCString()},{}]){
    const chercher=creerRechercheParNom({...config,maintenant:()=>temps,requeteHttp:async()=>new Response('',{status:429,headers})});
    assert.equal((await chercher('biscuits')).reessayerDans,60);
  }
});

function attendreAbandon(_url,{signal}) {
  return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
}

test('annuler pendant la requête arrête les reprises et ne produit pas une erreur visible', async () => {
  const controleur=new AbortController();let appels=0;
  const chercher=creerRechercheParNom({...config,requeteHttp:(...args)=>{appels++;queueMicrotask(()=>controleur.abort());return attendreAbandon(...args);}});
  assert.equal((await chercher('biscuits',{signal:controleur.signal})).etat,'annule');assert.equal(appels,1);
});

test('un timeout est repris et le budget global termine une recherche qui ne répond jamais', async () => {
  let appels=0;
  const chercher=creerRechercheParNom({...config,delaiTentative:5,requeteHttp:(...args)=>++appels===1?attendreAbandon(...args):Promise.resolve(succes())});
  assert.equal((await chercher('biscuits')).etat,'trouve');assert.equal(appels,2);
  const bloque=creerRechercheParNom({...config,delaiTentative:1000,budget:10,requeteHttp:attendreAbandon});
  assert.equal((await bloque('biscuits')).etat,'indisponible');
});

test('annuler pendant la pause empêche une nouvelle requête', async () => {
  let appels=0;const controleur=new AbortController();
  const chercher=creerRechercheParNom({...config,pause:100,requeteHttp:async()=>{appels++;setTimeout(()=>controleur.abort(),5);return new Response('',{status:503});}});
  assert.equal((await chercher('biscuits',{signal:controleur.signal})).etat,'annule');assert.equal(appels,1);
});

test('la recherche par nom se limite aux produits vendus en France', async () => {
  let url = '';
  const chercher = creerRechercheParNom({ ...config, requeteHttp: async u => { url = u; return succes(); } });
  await chercher('intima');
  assert.match(url, /tagtype_0=countries&tag_contains_0=contains&tag_0=france/);
});

test('recherche multi-bases : Open Food Facts d’abord, puis les bases sœurs marquées, sans doublon', async () => {
  const { creerRechercheMultiBases } = await import('./openfoodfacts.ts');
  const fiche = (ean, name) => ({ ean13: ean, name, brand: null, imageUrl: null, grammageG: null, volumeMl: null, productType: null, categoryKey: null, nutriscore: null });
  const chercher = creerRechercheMultiBases({
    principale: async () => ({ etat: 'trouve', fiches: [fiche('1', 'Pâte brisée')] }),
    soeurs: [
      { nom: 'Open Beauty Facts', chercher: async () => ({ etat: 'vide' }) },
      { nom: 'Open Products Facts', chercher: async () => ({ etat: 'trouve', fiches: [fiche('1', 'Doublon'), fiche('2', 'Papier sulfurisé')] }) },
    ],
  });
  const r = await chercher('papier sulfurise');
  assert.deepEqual(r.fiches.map(f => [f.name, f.origine]), [['Pâte brisée', undefined], ['Papier sulfurisé', 'Open Products Facts']]);
});

test('recherche multi-bases : seule une base sœur trouve, ou personne ne répond', async () => {
  const { creerRechercheMultiBases } = await import('./openfoodfacts.ts');
  const gel = { ean13: '3', name: 'Gel intime', brand: null, imageUrl: null, grammageG: null, volumeMl: null, productType: null, categoryKey: null, nutriscore: null };
  const trouve = creerRechercheMultiBases({ principale: async () => ({ etat: 'vide' }),
    soeurs: [{ nom: 'Open Beauty Facts', chercher: async () => ({ etat: 'trouve', fiches: [gel] }) }] });
  assert.equal((await trouve('gel intime')).fiches[0].origine, 'Open Beauty Facts');
  const panne = creerRechercheMultiBases({ principale: async () => ({ etat: 'indisponible', raison: 'reseau' }),
    soeurs: [{ nom: 'Open Beauty Facts', chercher: async () => ({ etat: 'indisponible', raison: 'reseau' }) }] });
  assert.deepEqual(await panne('gel intime'), { etat: 'indisponible', raison: 'reseau' });
});
