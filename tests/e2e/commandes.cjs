/* Commandes (EP2a, EP2c) : « Panier rempli » se compare aux achats précédents, Mes commandes liste factures et paniers, le résumé filtre les prix changés. */
const {chromium}=require('playwright');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:false,volume_ml:null,grammage_g:null,nutriscore:null,alternatives:[],vendu_chez:null,phrases_siri:[],category:'epi'};
const products=[{...base,id:'pq',name:'Papier toilette Essential',ean13:'1',image_url:null,product_type:'papier toilette'},{...base,id:'oig',name:'Oignons jaunes',ean13:'2',image_url:null,product_type:'oignon'}];
const f=x=>({commande:'A',purchase_date:'2023-07-23',drive:'carrefour',magasin:'Carrefour Lattes',product_id:null,ean13:null,libelle:'x',quantity_delivered:1,total_ttc:1,unit_price_ttc:1,...x});
const factures=[
 f({ean13:'1',product_id:'pq',libelle:'Papier toilette Essential',total_ttc:5.55,unit_price_ttc:5.55}),
 f({ean13:'2',product_id:'oig',libelle:'Oignons jaunes vrac',total_ttc:0.89,unit_price_ttc:0.89}),
 f({ean13:'5',product_id:'pan',libelle:'Pancetta',total_ttc:2,unit_price_ttc:2}),
 f({commande:'B',purchase_date:'2025-12-08',ean13:'1',product_id:'pq',libelle:'Papier toilette Essential',total_ttc:4.69,unit_price_ttc:4.69}),
 f({commande:'B',purchase_date:'2025-12-08',ean13:'2',product_id:'oig',libelle:'Oignons jaunes vrac',total_ttc:1.33,unit_price_ttc:1.33}),
 f({commande:'B',purchase_date:'2025-12-08',ean13:'9',libelle:'Houmous basilic',total_ttc:2.89,unit_price_ttc:2.89}),
];
const job={id:'j1',status:'done',created_at:'2026-09-30T18:00:00Z',finished_at:'2026-09-30T18:20:00Z',progress:{},error:null,results:{carrefour:[
 {item:'papier toilette',ok:true,quantity:1,label:'Papier toilette Essential',product_id:'pq',prix:4.59},
 {item:'oignons',ok:true,quantity:1,label:'Oignons jaunes',product_id:'oig',prix:1.89},
 {item:'pancetta',ok:true,quantity:1,label:'Pancetta Carrefour',product_id:'pan',prix:2},
]}};
const dossier=process.env.CAPTURES||'/tmp';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=req.url();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/purchase_lines'))data=factures;
  else if(url.includes('/rest/v1/cart_jobs'))data=url.includes('id=eq.')?job:[job];
  else if(url.includes('/rest/v1/offres_drive'))data=[];
  else if(url.includes('/rest/v1/products'))data=products;
  await route.fulfill({json:data});});
 await page.addInitScript(({session})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));},{session});
 // EP2a : sur « Panier rempli », la comparaison arrive avec le panier.
 await page.goto('http://localhost:8082/suivi/envoye?id=j1&n=3&drives=carrefour');
 await page.getByText('Panier rempli.',{exact:true}).waitFor({timeout:60000});
 await page.getByText('Par rapport à tes achats précédents',{exact:true}).waitFor();
 await page.getByText('+6 %',{exact:true}).first().waitFor();
 await page.getByText('3 produits · 8,02 € → 8,48 €',{exact:true}).waitFor();
 await page.getByText('1,33 € → 1,89 € · déc. 2025',{exact:true}).waitFor();
 await page.screenshot({path:dossier+'/ep2a.png'});
 // EP2c : Mes commandes, puis le résumé d'une facture.
 await page.goto('http://localhost:8082/commandes');
 await page.getByText('Mes commandes',{exact:true}).waitFor();
 await page.getByText('Panier rempli · Carrefour · 3 produits',{exact:true}).waitFor();
 await page.getByText('Carrefour Lattes · 3 produits',{exact:true}).first().waitFor();
 await page.getByText('Premiers achats, rien à comparer',{exact:true}).waitFor();
 await page.screenshot({path:dossier+'/ep2c.png'});
 await page.getByRole('button',{name:/^8 déc\. 2025/}).click();
 await page.getByText('Déjà achetés : 2 produits',{exact:true}).waitFor();
 await page.getByText('−7 %',{exact:true}).last().waitFor();
 await page.getByText('avant 0,89 € · juil. 2023',{exact:true}).waitFor();
 await page.getByText('+49 %',{exact:true}).waitFor();
 await page.getByRole('tab',{name:'Nouveaux · 1'}).click();
 await page.getByText('Houmous basilic',{exact:true}).waitFor();
 await page.getByRole('tab',{name:'Prix changés · 2'}).click();
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/ep2-resume.png'});
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
