/* Mes produits (MP2) : une liste par rayon, le dernier prix payé et où, le nombre de choix ; la recherche filtre dans tous les rayons. */
const {chromium}=require('playwright');
const PORT=process.env.PORT||'8082';
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:false,image_url:null,volume_ml:null,grammage_g:null,nutriscore:null,alternatives:[],vendu_chez:null,phrases_siri:[],ean13:null,brand:null};
const products=[
 {...base,id:'emm',name:'Emmental râpé fondant CARREFOUR',category:'pls',product_type:'fromage rape',grammage_g:200,alternatives:['pres']},
 {...base,id:'pres',name:'Emmental Président',category:'pls',product_type:'fromage rape',grammage_g:200},
 {...base,id:'lait',name:'Lait demi-écrémé Lactel',category:'pls',product_type:'lait',volume_ml:1000},
 {...base,id:'all',name:'Allumettes Tradilège',category:'charcuterie',product_type:'allumettes',grammage_g:150},
 {...base,id:'avo',name:'Avocat',category:'fruits_legumes',product_type:'avocat'},
];
const achats=[
 {product_id:'emm',purchase_date:'2025-12-08',drive:'carrefour',magasin:null,commande:'1',quantity_delivered:1,unit_price_ttc:2.99,remise_ttc:0,total_ttc:2.99},
 {product_id:'all',purchase_date:'2026-02-16',drive:'leclerc',magasin:null,commande:'2',quantity_delivered:2,unit_price_ttc:1.05,remise_ttc:0,total_ttc:2.1},
 {product_id:'all',purchase_date:'2025-11-16',drive:'leclerc',magasin:null,commande:'3',quantity_delivered:1,unit_price_ttc:0.99,remise_ttc:0,total_ttc:0.99},
];
const dossier=process.env.CAPTURES||'/tmp';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const url=decodeURIComponent(route.request().url());let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/purchase_lines'))data=achats;
  else if(url.includes('/rest/v1/products'))data=products;
  await route.fulfill({json:data});});
 await page.addInitScript(({session})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));},{session});
 await page.goto(`http://localhost:${PORT}/favoris`);
 await page.getByText('PRODUITS LAITIERS · 2',{exact:true}).waitFor({timeout:60000});
 for(const t of ['FRUITS & LÉGUMES · 1','CHARCUTERIE & TRAITEUR · 1'])await page.getByText(t,{exact:true}).waitFor();
 // L'alternative n'est pas une ligne à part : elle compte dans « 2 choix ».
 if(await page.getByText('Emmental Président',{exact:true}).count())throw Error('Alternative affichée comme référence');
 await page.getByRole('button',{name:/^Consulter Emmental râpé fondant CARREFOUR, 200 g, 2 choix, dernier prix 2,99 € chez Carrefour, /}).waitFor();
 // Le dernier achat l'emporte, au prix unitaire.
 await page.getByText('1,05 €',{exact:true}).waitFor();await page.getByText('E.Leclerc · 16 févr.',{exact:true}).waitFor();
 if(await page.getByText('Jamais acheté',{exact:true}).count()!==2)throw Error('Jamais acheté attendu pour le lait et l’avocat');
 await page.screenshot({path:dossier+'/mp2.png'});
 await page.getByLabel('Chercher un produit').fill('lait');
 await page.getByText('Lait demi-écrémé Lactel',{exact:true}).waitFor();
 if(await page.getByText('CHARCUTERIE & TRAITEUR · 1',{exact:true}).count())throw Error('La recherche devrait masquer les rayons vides');
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
