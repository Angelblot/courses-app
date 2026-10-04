/* Liens aux drives (LF1 · RL1 · AA1) : le récapitulatif, la ligne de la fiche et sa feuille, et l'option « Ailleurs » avec son lieu. */
const {chromium}=require('playwright');
const PORT=process.env.PORT||'8082';
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:false,image_url:null,volume_ml:null,grammage_g:null,nutriscore:null,alternatives:[],vendu_chez:null,lieu_achat:null,phrases_siri:[],ean13:null,brand:null};
const products=[
 {...base,id:'lait',name:'Lait demi-écrémé',category:'pls',product_type:'lait'},
 {...base,id:'mort',name:'Mortadelle Negroni',category:'charcuterie',product_type:'mortadelle',brand:'Negroni'},
 {...base,id:'avocat',name:'Avocats',category:'fruits_legumes',product_type:'avocat',vendu_chez:'ailleurs',lieu_achat:'Marché'},
];
const dossier=process.env.CAPTURES||'/tmp';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[],ecritures=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=decodeURIComponent(req.url());let data=[];
  if(req.method()!=='GET'&&url.includes('/rest/v1/'))ecritures.push({m:req.method(),url,body:req.postData()});
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/purchase_lines'))data=url.includes('select=product_id,drive')||url.includes('select=product_id, drive')?[{product_id:'lait',drive:'carrefour'}].filter(x=>!url.includes('product_id=eq.')||url.includes('product_id=eq.'+x.product_id)):[];
  else if(url.includes('/rest/v1/product_equivalents'))data=req.method()==='GET'?[]:[];
  else if(url.includes('/rest/v1/products'))data=req.method()!=='GET'?[]:url.includes('reprise_statut')?{image_url:null,image_originale:null,image_reprise:null,reprise_statut:null,reprise_le:null}:url.includes('ean13=eq.')?null:products;
  await route.fulfill({json:data});});
 await page.addInitScript(({session})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));},{session});
 // Le récapitulatif : par défaut, les produits reliés à aucun drive.
 await page.goto(`http://localhost:${PORT}/compte`);
 await page.getByRole('button',{name:/^Liens aux drives/}).click({timeout:60000});
 await page.getByRole('tab',{name:'Aucun drive : 1 produits'}).waitFor();
 await page.getByRole('tab',{name:'Carrefour seul : 1 produits'}).waitFor();
 await page.getByText('1 produit acheté hors drive',{exact:true}).waitFor();
 await page.getByText('Mortadelle Negroni',{exact:true}).waitFor();
 if(await page.getByText('Lait demi-écrémé',{exact:true}).count())throw Error('Le lait relié ne devrait pas être listé sous « Aucun drive »');
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/rl1.png'});
 await page.getByRole('tab',{name:/^Carrefour seul/}).click();
 await page.getByText('Lait demi-écrémé',{exact:true}).waitFor();
 await page.getByText('E.Leclerc · pas de lien',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Voir les produits achetés hors drive : 1'}).click();
 await page.getByText('Hors drive · Marché',{exact:true}).waitFor();
 // La fiche : la ligne « Liens aux drives » signale l'absence de lien.
 await page.getByRole('tab',{name:/^Aucun drive/}).click();
 await page.getByRole('button',{name:/^Mortadelle Negroni/}).click();
 const ligne=page.getByRole('button',{name:/^Liens aux drives : Aucun\. Carrefour : pas de lien · E\.Leclerc : pas de lien/});
 // L'ordre d'essai parle des mêmes liens que le récapitulatif.
 await page.getByLabel(/^Mortadelle Negroni\. Carrefour : pas de lien, E\.Leclerc : pas de lien$/).waitFor();
 await ligne.scrollIntoViewIfNeeded({timeout:30000});await page.waitForTimeout(300);
 await page.screenshot({path:dossier+'/lf1-ligne.png'});
 await ligne.click();
 await page.getByText('L’extension l’ouvrira par son code-barres.',{exact:true}).waitFor();
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/lf1-feuille.png'});
 await page.getByRole('button',{name:'Marquer absent chez E.Leclerc'}).click();
 await page.waitForTimeout(500);
 const upsert=ecritures.find(e=>e.url.includes('product_equivalents')&&e.m==='POST');
 if(!upsert||!/"unavailable":true/.test(upsert.body)||!/"drive":"leclerc"/.test(upsert.body)||!upsert.url.includes('on_conflict=user_id,product_id,drive'))throw Error('Marquer absent : '+JSON.stringify(ecritures));
 // « Je l'achète ailleurs » ouvre « Vendu chez », où l'on choisit le lieu.
 await page.getByRole('button',{name:'Je l’achète ailleurs'}).click();
 await page.getByText('Ailleurs',{exact:true}).click({timeout:10000});
 await page.getByRole('button',{name:'Marché'}).click();
 await page.waitForTimeout(500);
 const lieux=ecritures.filter(e=>e.url.includes('/rest/v1/products')&&e.m!=='GET').map(e=>e.body).join('\n');
 if(!/"vendu_chez":"ailleurs"/.test(lieux)||!/"lieu_achat":"Marché"/.test(lieux))throw Error('Lieu non enregistré : '+lieux);
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/aa1.png'});
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
