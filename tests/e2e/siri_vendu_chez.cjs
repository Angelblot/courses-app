/* Siri non reconnu (RS1) et réglages de la fiche (FS2) : la phrase est retenue, le drive se règle. */
const {chromium}=require('playwright');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:false,image_url:null,volume_ml:null,nutriscore:null,category:'hygiene',grammage_g:null,alternatives:[],vendu_chez:null,ean13:null};
const products=[
 {...base,id:'lotus',name:'Papier toilette Lotus Confort',brand:'Lotus',product_type:'papier toilette',phrases_siri:[]},
 {...base,id:'okay',name:'Essuie-tout Okay',brand:'Okay',product_type:'essuie tout',phrases_siri:['pq']},
 {...base,id:'lait',name:'Lait demi-écrémé',brand:'Lactel',product_type:'lait',category:'pls',phrases_siri:[]},
];
const dossier=process.env.CAPTURES||'/tmp';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ecritures=[];
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=req.url();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/products')&&req.method()==='PATCH'){const id=new URL(url).searchParams.get('id').replace('eq.','');const corps=req.postDataJSON();ecritures.push({id,...corps});Object.assign(products.find(p=>p.id===id),corps);}
  else if(url.includes('/rest/v1/products'))data=url.includes('reprise_statut')?{image_url:null,image_originale:null,image_reprise:null,reprise_statut:null,reprise_le:null}:products;
  await route.fulfill({json:data});});
 await page.addInitScript(({session,id})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));if(!localStorage.getItem('seeded')){localStorage.setItem('tablee-maison-v1:'+id,JSON.stringify({quotidien:{lait:'needed'},quotidienQty:{lait:2},extras:[{id:'siri-lotus',name:'Lotus',quantity:1,unit:'unité',rayon:'autre'}],manques:{'extra:siri-lotus':{name:'Lotus',source:'siri'},'produit:lait':{name:'Lait demi-écrémé',source:'siri'}}}));localStorage.setItem('seeded','yes');}},{session,id:user.id});
 const btn=(name)=>page.getByRole('button',{name,exact:true});
 // RS1 : la ligne signale le raté ; la feuille propose Lotus, déjà coché.
 await page.goto('http://localhost:8082/manques');
 const ligne=page.getByRole('button',{name:'Lotus, dit à Siri, produit pas reconnu. Choisir le produit'});await ligne.waitFor({timeout:60000});
 await ligne.click();await page.getByText('« Lotus », c’est lequel ?',{exact:true}).first().waitFor();
 const radio=page.getByRole('radio',{name:'Papier toilette Lotus Confort'});
 if(await radio.getAttribute('aria-checked')!=='true')throw Error('Most probable product is not preselected');
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/rs1.png'});
 await btn('Associer « Lotus »').click();
 await page.getByText('Papier toilette Lotus Confort',{exact:true}).first().waitFor();
 if(JSON.stringify(ecritures[0])!==JSON.stringify({id:'lotus',phrases_siri:['lotus']}))throw Error('Bad phrase '+JSON.stringify(ecritures));
 await page.waitForTimeout(800);await page.screenshot({path:dossier+'/apres.png'});if(await page.getByText('Siri · produit pas reconnu').count())throw Error('Row still unrecognised');
 // FS2 : lignes Siri et Vendu chez dans la fiche.
 await page.goto('http://localhost:8082/favoris');
 await page.getByRole('button',{name:/^Consulter Papier toilette Lotus/}).click();
 const siri=page.getByRole('button',{name:'Siri : papier toilette, lotus. Modifier'});await siri.waitFor();
 await page.getByRole('button',{name:'Vendu chez : Partout. Modifier'}).scrollIntoViewIfNeeded();await page.waitForTimeout(300);
 await page.screenshot({path:dossier+'/fs2.png'});
 await page.getByRole('button',{name:'Vendu chez : Partout. Modifier'}).click();
 await page.getByText('Déduit de la marque : Lotus se trouve partout.').waitFor();await page.waitForTimeout(400);
 await page.screenshot({path:dossier+'/fs2-drive.png'});
 await page.getByRole('radio',{name:'Carrefour seulement'}).click();
 await page.getByRole('button',{name:'Vendu chez : Carrefour seulement. Modifier'}).waitFor();
 if(JSON.stringify(ecritures.at(-1))!==JSON.stringify({id:'lotus',vendu_chez:'carrefour'}))throw Error('Bad drive '+JSON.stringify(ecritures));
 // Une phrase déjà prise passe d'un produit à l'autre.
 await siri.click();await page.getByLabel('Nouvelle phrase pour Siri').fill('PQ');
 await btn('Ajouter cette phrase').click();
 await page.getByText('« pq » désignait Essuie-tout Okay ; il désigne maintenant ce produit.').waitFor();
 const deux=JSON.stringify(ecritures.slice(-2));
 if(deux!==JSON.stringify([{id:'lotus',phrases_siri:['lotus','pq']},{id:'okay',phrases_siri:[]}]))throw Error('Bad move '+deux);
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/fs2-siri.png'});
 await btn('Retirer « lotus »').click();await page.waitForTimeout(500);
 if(JSON.stringify(ecritures.at(-1))!==JSON.stringify({id:'lotus',phrases_siri:['pq']}))throw Error('Bad remove '+JSON.stringify(ecritures.at(-1)));
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true,ecritures:ecritures.length}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
