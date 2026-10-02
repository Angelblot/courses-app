/* Comparatif d'un produit (CP3) : le nuage prix et Nutri-Score dans sa fiche, un point touché affiche sa ligne. */
const {chromium}=require('playwright');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:false,image_url:null,volume_ml:null,nutriscore:'d',alternatives:[],vendu_chez:null,phrases_siri:[],category:'pls'};
const products=[{...base,id:'emm',name:'Emmental râpé fondant',ean13:'3560071178345',brand:'Carrefour',grammage_g:200,product_type:'fromage rape'}];
const vu=new Date(Date.now()-2*86400000).toISOString();
const o=x=>({drive:'carrefour',product_id:'emm',recherche:'Emmental râpé fondant',marque:null,url:'https://www.carrefour.fr/p/x',image_url:null,unite_prix:'kg',volume_ml:null,promotion:null,disponible:true,choisi:false,vu_le:vu,...x});
const offres=[
 o({libelle:'Emmental râpé fondant Carrefour 200 g',ean13:'3560071178345',marque:'Carrefour',prix:2.45,prix_unitaire:12.25,grammage_g:200,nutriscore:'d',choisi:true}),
 o({libelle:'Emmental râpé Carrefour 500 g',ean13:'3560071178352',marque:'Carrefour',prix:5.2,prix_unitaire:10.4,grammage_g:500,nutriscore:'d'}),
 o({libelle:'Gruyère râpé 100 g',ean13:'3564709168807',drive:'leclerc',prix:1.29,prix_unitaire:12.9,grammage_g:100,nutriscore:'c',url:null}),
 o({libelle:'Parmigiano Reggiano râpé 100 g',ean13:'8001234567890',prix:2.99,prix_unitaire:29.9,grammage_g:100,nutriscore:'d'}),
 o({libelle:'Râpé premier prix 200 g',ean13:'3560071111111',prix:1.8,prix_unitaire:9,grammage_g:200,nutriscore:'e',promotion:'-30 %'}),
];
const dossier=process.env.CAPTURES||'/tmp';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ecritures=[];
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=req.url();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/offres_drive'))data=offres;
  else if(url.includes('/rest/v1/products')&&req.method()==='POST'){const c=req.postDataJSON();const p={...base,...c,id:'emm500'};products.push(p);data=p;}
  else if(url.includes('/rest/v1/products')&&req.method()==='PATCH'){const id=new URL(url).searchParams.get('id').replace('eq.','');ecritures.push({id,...req.postDataJSON()});}
  else if(url.includes('/rest/v1/products'))data=url.includes('reprise_statut')?{image_url:null,image_originale:null,image_reprise:null,reprise_statut:null,reprise_le:null}:url.includes('ean13=eq.')?null:products;
  await route.fulfill({json:data});});
 await page.addInitScript(({session})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));},{session});
 await page.goto('http://localhost:8082/favoris');
 await page.getByRole('button',{name:/^Consulter Emmental râpé fondant/}).click({timeout:60000});
 await page.getByText('Prix et Nutri-Score',{exact:true}).waitFor();
 await page.getByText('5 produits vus',{exact:false}).waitFor();
 // Par défaut, la meilleure alternative moins chère au kilo est détaillée.
 await page.getByText('Râpé premier prix 200 g',{exact:true}).waitFor();
 await page.getByText('Prix et Nutri-Score',{exact:true}).scrollIntoViewIfNeeded();await page.waitForTimeout(400);
 await page.screenshot({path:dossier+'/cp3.png'});
 await page.getByRole('button',{name:/^Emmental râpé Carrefour 500 g, 10,40 € par kilo/}).click();
 await page.getByText('−15 %',{exact:true}).waitFor();
 await page.getByRole('button',{name:/Ajouter à mon ordre d’essai/}).click();
 await page.getByText('Ajouté à ton ordre d’essai.',{exact:true}).waitFor();
 if(JSON.stringify(ecritures.at(-1))!==JSON.stringify({id:'emm',alternatives:['emm500']}))throw Error('Bad write '+JSON.stringify(ecritures));
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/cp3-ajout.png'});
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
