/* Prix payé (EP1) : dans la fiche produit, le dernier prix, l'écart, la courbe et la liste des achats lus sur les factures. */
const {chromium}=require('playwright');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:false,image_url:null,volume_ml:null,grammage_g:null,nutriscore:null,alternatives:[],vendu_chez:null,phrases_siri:[],category:'hyg'};
const products=[{...base,id:'pq',name:'Papier toilette Essential',ean13:'3560070150403',brand:'Carrefour Essential',product_type:'papier toilette'},{...base,id:'chor',name:'Chorizo doux',ean13:'3560071504465',brand:'Simpl',product_type:'chorizo'}];
const l=x=>({drive:'carrefour',magasin:'Carrefour Lattes',commande:'1',quantity_delivered:1,unit_price_ttc:5.55,remise_ttc:0,total_ttc:5.55,...x});
const lignes=[
 l({purchase_date:'2023-03-14',quantity_delivered:2,unit_price_ttc:5.5,remise_ttc:-1.65,total_ttc:9.35}),
 l({purchase_date:'2023-04-28',quantity_delivered:2,unit_price_ttc:5.55,remise_ttc:-1.67,total_ttc:9.43}),
 l({purchase_date:'2023-05-10',magasin:'Carrefour Market Le Crès',unit_price_ttc:5.55,total_ttc:5.55}),
 l({purchase_date:'2023-06-14'}),l({purchase_date:'2023-07-23'}),
 l({purchase_date:'2025-12-08',unit_price_ttc:4.69,total_ttc:4.69}),
];
const releves=[{vu_le:'2026-09-28T10:00:00Z',drive:'leclerc',prix:4.35,promotion:null}];
const dossier=process.env.CAPTURES||'/tmp';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let filtre=null;
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=req.url();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/purchase_lines')){filtre=decodeURIComponent(url);data=!url.includes('select=purchase_date')?[]:url.includes('chor')?[l({purchase_date:'2025-12-08',unit_price_ttc:1.79,total_ttc:1.79})]:lignes;}
  else if(url.includes('/rest/v1/offres_drive'))data=url.includes('choisi=eq.true')&&!url.includes('chor')?releves:[];
  else if(url.includes('/rest/v1/products'))data=url.includes('reprise_statut')?{image_url:null,image_originale:null,image_reprise:null,reprise_statut:null,reprise_le:null}:url.includes('ean13=eq.')?null:products;
  await route.fulfill({json:data});});
 await page.addInitScript(({session})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));},{session});
 await page.goto('http://localhost:8082/favoris');
 await page.getByRole('button',{name:/^Consulter Papier toilette Essential/}).click({timeout:60000});
 await page.getByText('Prix payé',{exact:true}).waitFor();
 if(!filtre||!filtre.includes('ean13.eq.3560070150403'))throw Error('Filtre attendu par code-barres : '+filtre);
 // Le dernier achat est le prix relevé chez Leclerc, et la liste commence par lui.
 await page.getByText('7 achats',{exact:true}).waitFor();
 await page.getByText('4,35 €',{exact:true}).first().waitFor();
 await page.getByText('−7 % depuis 2023',{exact:true}).waitFor();
 await page.getByText('relevé sur le drive',{exact:true}).waitFor();
 await page.getByText('8 déc. 2025 · Carrefour Lattes',{exact:true}).waitFor();
 await page.getByText('Voir les 7 achats',{exact:true}).waitFor();
 await page.getByText('Prix payé',{exact:true}).scrollIntoViewIfNeeded();await page.waitForTimeout(400);
 await page.screenshot({path:dossier+'/ep1.png'});
 await page.getByRole('button',{name:'Voir les 7 achats'}).click();
 await page.getByText('14 mars 2023 · Carrefour Lattes',{exact:true}).waitFor();
 await page.getByText('10 mai 2023 · Carrefour Market Le Crès',{exact:true}).waitFor();
 await page.getByText('−15 %',{exact:true}).first().waitFor();
 await page.getByText('au lieu de 5,50 €',{exact:true}).waitFor();
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/ep1-tout.png',fullPage:false});
 // Un seul achat : seulement la ligne d'historique, avec le marchand.
 await page.goto('http://localhost:8082/favoris');
 await page.getByRole('button',{name:/^Consulter Chorizo doux/}).click({timeout:60000});
 await page.getByText('1 achat',{exact:true}).waitFor();
 await page.getByText('8 déc. 2025 · Carrefour Lattes',{exact:true}).waitFor();
 if(await page.getByText('1,79 €',{exact:true}).count()!==1)throw Error('Le prix est répété');
 await page.getByText('Prix payé',{exact:true}).scrollIntoViewIfNeeded();await page.waitForTimeout(300);
 await page.screenshot({path:dossier+'/ep1-un-achat.png'});
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
