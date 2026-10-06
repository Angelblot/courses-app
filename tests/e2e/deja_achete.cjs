/* Préciser : tes produits en tête de chaque enseigne (« Déjà acheté ici »), rien ne passe avant « Valider », puis le point revu par enseigne et « Modifier ». */
const {chromium}=require('playwright');
const PORT=process.env.PORT||'8082';
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:false,image_url:null,volume_ml:null,nutriscore:null,grammage_g:null,alternatives:[],vendu_chez:null,phrases_siri:[],ean13:null,brand:null,category:'autre'};
const products=[{...base,id:'florelli',name:'Gressins Florelli Au Sésame 300g',ean13:'3000000000011',brand:'Florelli',product_type:'gressins'},
 {...base,id:'tokapi',name:'Gressins Tokapi Sésame 125g',brand:'Marque Repère',product_type:'gressins'}];
const dossier=process.env.CAPTURES||'/tmp';
const etat={quotidien:{},quotidienQty:{},ligneQuantites:{},lignePossedees:{},selectedRecipes:{},choixProduits:{},drives:['carrefour','leclerc'],
 extras:[{id:'rappel-g',name:'Gressin',quantity:1,unit:'unité',rayon:'autre'},{id:'rappel-j',name:'Javel',quantity:1,unit:'unité',rayon:'autre'}],
 manques:{'extra:rappel-g':{name:'Gressin',source:'rappels'},'extra:rappel-j':{name:'Javel',source:'rappels'}},importsExternes:['rappel:g','rappel:j']};
const maintenant=new Date().toISOString();
const offre=(id,drive,rang,libelle,prix,ean13=null,extra={})=>({id,recherche_id:drive==='carrefour'?'rc':'rl',drive,libelle,marque:null,ean13,url:null,image_url:null,
 prix,prix_unitaire:null,unite_prix:null,grammage_g:null,volume_ml:null,nutriscore:null,promotion:null,disponible:true,rang,vu_le:maintenant,...extra});
const recherches=[{id:'rc',drive:'carrefour',requete:'Gressin',ean13:null,statut:'faite',resultats:3,demandee_le:maintenant,faite_le:maintenant,type:'recherche'},
 {id:'rl',drive:'leclerc',requete:'Gressin',ean13:null,statut:'faite',resultats:3,demandee_le:maintenant,faite_le:maintenant,type:'recherche'}];
const offres=[offre('c1','carrefour',0,'FLORELLI Gressins Traditionnels 300g',2.25,'3000000000011',{prix_unitaire:7.5,unite_prix:'kg'}),offre('c2','carrefour',1,'CARREFOUR CLASSIC Gressins 125g',1.09),offre('c3','carrefour',2,'GRISSINI Gressins à l’huile d’olive 250g',2.49),
 offre('l1','leclerc',0,'Gressins Repère Nature 250g',1.39),offre('l2','leclerc',1,'Gressins Tokapi Sésame - 125g',1.15,null,{prix_unitaire:9.2,unite_prix:'kg'}),offre('l3','leclerc',2,'Gressins au romarin 200g',1.79)];
const achats=[{product_id:'florelli',drive:'carrefour',libelle:'GRESSINS FLORELLI',ean13:'3000000000011',unit_price_ttc:2.19,purchase_date:'2026-08-02'},
 {product_id:'florelli',drive:'carrefour',libelle:'GRESSINS FLORELLI',ean13:'3000000000011',unit_price_ttc:2.25,purchase_date:'2026-09-12'},
 {product_id:'tokapi',drive:'leclerc',libelle:'Gressins Tokapi Sésame 125g',ean13:null,unit_price_ttc:1.15,purchase_date:'2026-08-28'}];
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});let page;try{
 page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ecrit={produits:[],liens:[]};
 await page.route(/open(food|beauty|products)facts\.org/,route=>route.fulfill({json:{products:[],count:0}}));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=decodeURIComponent(req.url().replace(/\+/g,'%20')),m=req.method();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/recherches_drive'))data=url.includes('statut=in.')||url.includes('type=eq.fiche')?[]:recherches.filter(r=>url.includes(`requete=eq.${r.requete}`));
  else if(url.includes('/rest/v1/offres_drive'))data=url.includes('Javel')?[]:offres;
  else if(url.includes('/rest/v1/purchase_lines'))data=achats;
  else if(url.includes('/rest/v1/product_equivalents')&&m==='POST')ecrit.liens.push(req.postDataJSON());
  else if(url.includes('/rest/v1/product_equivalents'))data=[];
  else if(url.includes('/rest/v1/extension_presence'))data={vue_le:maintenant,activite:'prete',detail:{auto:true}};
  else if(url.includes('/rest/v1/products')&&m==='POST'){ecrit.produits.push(req.postDataJSON());data={id:'cree'};}
  else if(url.includes('/rest/v1/products')&&url.includes('select=alternatives'))data={alternatives:[]};
  else if(url.includes('/rest/v1/products'))data=url.includes('ean13=eq.')?null:products;
  else if(url.includes('/functions/v1/'))data={ok:false};
  await route.fulfill({json:data});});
 await page.addInitScript(({session,id,etat})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));if(!localStorage.getItem('seeded')){localStorage.setItem('tablee-maison-v1:'+id,JSON.stringify(etat));localStorage.setItem('seeded','yes');}},{session,id:user.id,etat});
 const btn=(name)=>page.getByRole('button',{name,exact:true}),texte=(t)=>page.getByText(t,{exact:true});
 await page.goto(`http://localhost:${PORT}`);await btn('Préparer mes courses').waitFor({timeout:60000});
 await btn('Préparer mes courses').click();await btn('Voir le bilan').click();
 await page.getByRole('button',{name:/^Manques :.*Préciser$/}).last().click();
 await texte('« Gressin »').waitFor();
 // Plus de champ ni de « Proches dans tes produits » : tes produits sont dans les onglets.
 if(await texte('Proches dans tes produits').count())throw Error('Liste « Proches » encore là');
 if(await page.getByRole('textbox',{name:'Chercher un produit'}).count())throw Error('Champ de recherche encore là');
 await texte('Déjà acheté ici').waitFor({timeout:20000});await texte('Acheté 2 fois · dernier le 12 sept.').waitFor();
 await texte('Autres produits Carrefour').waitFor();
 await page.waitForTimeout(500);await page.screenshot({path:dossier+'/da1-carrefour.png'});
 // Choisir son produit Carrefour : l'onglet E.Leclerc s'ouvre, rien ne passe au point suivant.
 await page.getByRole('radio',{name:/^FLORELLI Gressins Traditionnels/}).click();
 await texte('Puis ton produit E.Leclerc').waitFor();await texte('Acheté une fois · dernier le 28 août').waitFor();
 if(!(await texte('« Gressin »').count()))throw Error('Passé au point suivant');
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/da2-leclerc.png'});
 await page.getByRole('radio',{name:/^Gressins Tokapi Sésame - 125g/}).click();
 await btn('Valider les 2 produits').click();
 await texte('« Javel »').waitFor();
 if(ecrit.produits.length)throw Error('Doublon créé : '+JSON.stringify(ecrit.produits));
 if(ecrit.liens.map(l=>l.product_id).join()!=='florelli,tokapi')throw Error('Liens '+JSON.stringify(ecrit.liens));
 // Revoir le point : le produit retenu par enseigne, puis Modifier rouvre avec les choix cochés.
 await page.getByRole('button',{name:/^Revenir à « Gressin »/}).click();
 await texte('Réglé · 2 produits retenus').waitFor();await texte('Gressins Tokapi Sésame - 125g').waitFor();
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/da3-regle.png'});
 await btn('Modifier « Gressin »').click();
 await btn('Valider les 2 produits').waitFor({timeout:20000});
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/da4-modifier.png'});
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);await page?.screenshot({path:dossier+'/da-erreur.png'}).catch(()=>{});process.exitCode=1}finally{await b.close()}})();
