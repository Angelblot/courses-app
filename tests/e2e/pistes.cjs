/* Pistes (PP1) : une carte chiffrée par piste, « Essayer à la prochaine commande » change l'ordre d'essai, annulable. */
const {chromium}=require('playwright');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:false,image_url:null,volume_ml:null,alternatives:[],vendu_chez:null,phrases_siri:[],category:'pls'};
const products=[
 {...base,id:'emm',name:'Emmental râpé fondant',ean13:'3560071178345',brand:'Carrefour',grammage_g:200,product_type:'fromage rape',nutriscore:'d'},
 {...base,id:'lait',name:'Lait demi-écrémé',ean13:'3000000000001',brand:'Lactel',grammage_g:null,volume_ml:1000,product_type:'lait',nutriscore:'c'},
];
const jour=n=>new Date(Date.now()-n*86400000).toISOString();
const o=x=>({drive:'carrefour',recherche:'x',url:null,image_url:null,volume_ml:null,promotion:null,disponible:true,choisi:false,vu_le:jour(2),...x});
const offres=[
 o({product_id:'emm',libelle:'Emmental râpé Carrefour 200 g',ean13:'3560071178345',marque:'Carrefour',prix:2.45,prix_unitaire:12.25,unite_prix:'kg',grammage_g:200,nutriscore:'d',choisi:true}),
 o({product_id:'emm',libelle:'Emmental râpé Carrefour 500 g',ean13:'3560071178352',marque:'Carrefour',prix:5.2,prix_unitaire:10.4,unite_prix:'kg',grammage_g:500,nutriscore:'d'}),
 o({product_id:'lait',libelle:'Lait demi-écrémé Lactel 1 L',ean13:'3000000000001',marque:'Lactel',prix:1.15,prix_unitaire:1.15,unite_prix:'l',volume_ml:1000,nutriscore:'c',choisi:true}),
 o({product_id:'lait',libelle:'Lait bio écrémé 1 L',ean13:'3000000000002',marque:'Bio Village',drive:'leclerc',prix:1.19,prix_unitaire:1.19,unite_prix:'l',volume_ml:1000,nutriscore:'b'}),
];
const envois=[{status:'done',created_at:jour(70),items:[{product_id:'emm',quantity:2},{product_id:'lait',quantity:6}]},{status:'done',created_at:jour(10),items:[{product_id:'emm',quantity:1},{product_id:'lait',quantity:6}]}];
const dossier=process.env.CAPTURES||'/tmp';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ecritures=[];
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=req.url();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/offres_drive'))data=offres;
  else if(url.includes('/rest/v1/cart_jobs'))data=envois;
  else if(url.includes('/rest/v1/products')&&req.method()==='POST'){const c=req.postDataJSON();const p={...base,...c,id:'emm500'};products.push(p);data=p;}
  else if(url.includes('/rest/v1/products')&&req.method()==='PATCH'){const id=new URL(url).searchParams.get('id').replace('eq.','');ecritures.push({id,...req.postDataJSON()});}
  else if(url.includes('/rest/v1/products'))data=url.includes('ean13=eq.')?null:products;
  await route.fulfill({json:data});});
 await page.addInitScript(({session})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));},{session});
 // L'accueil le signale.
 await page.goto('http://localhost:8082');
 await page.getByRole('button',{name:/^2 pistes, environ 6 euros par an\. Voir$/}).waitFor({timeout:60000});
 await page.screenshot({path:dossier+'/accueil.png'});
 await page.getByRole('button',{name:/^2 pistes/}).click();
 await page.getByText('PLUS GRAND, MOINS CHER',{exact:true}).waitFor();
 await page.getByText('MIEUX NOTÉ, MÊME PRIX',{exact:true}).waitFor();
 await page.getByText('Tu en prends environ une fois par mois. Même Nutri-Score.',{exact:true}).waitFor();
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/pistes.png'});
 await page.getByRole('button',{name:'Essayer à la prochaine commande'}).first().click();
 await page.getByText('Emmental râpé Carrefour 500 g sera essayé à la prochaine commande').last().waitFor();
 const deux=JSON.stringify(ecritures);
 if(deux!==JSON.stringify([{id:'emm500',alternatives:['emm']},{id:'emm',alternatives:[]}]))throw Error('Bad order '+deux);
 await page.getByRole('button',{name:'Annuler : Emmental râpé Carrefour 500 g sera essayé à la prochaine commande'}).last().click();
 await page.waitForTimeout(600);
 if(JSON.stringify(ecritures.slice(-2))!==JSON.stringify([{id:'emm',alternatives:[]},{id:'emm500',alternatives:[]}]))throw Error('Bad undo '+JSON.stringify(ecritures));
 // « Pas pour moi » retire la piste.
 await page.getByRole('button',{name:'Pas pour moi : Lait bio écrémé 1 L'}).click();
 await page.getByText('MIEUX NOTÉ, MÊME PRIX',{exact:true}).waitFor({state:'detached'});
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
