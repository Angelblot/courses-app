/* Bilan : « Ingrédients des repas » à lier (le lien vaut pour la recette), « Habitudes et liste » avec la part des repas, et le doublon avec « Retirer les deux ». */
const {chromium}=require('playwright');
const PORT=process.env.PORT||'8082';
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:true,image_url:null,volume_ml:null,nutriscore:null,grammage_g:null,alternatives:[],vendu_chez:null,phrases_siri:[],ean13:null,brand:null};
const products=[{...base,id:'oeufs',name:'Œufs Plein Air x6',category:'pls',product_type:'oeuf'},{...base,id:'beurre',name:'Beurre doux',category:'pls',product_type:'beurre'},
 {...base,id:'patates',name:'Pommes de terre',category:'fruits_legumes',grammage_g:1000,product_type:'pomme_de_terre'}];
const recipes=[{id:'rec1',name:'Quiche lorraine',servings_default:2,image_url:null,prep_minutes:15,cook_minutes:40,recipe_ingredients:[
 {id:'i-oeufs',name:'Œufs',quantity_per_serving:1,unit:'unité',rayon:'pls',product_id:'oeufs'},
 {id:'i-lardons',name:'Lardons',quantity_per_serving:1,unit:'unité',rayon:'boucherie',product_id:null}]}];
const dossier=process.env.CAPTURES||'/tmp';
const maintenant=new Date().toISOString();
const etat={sessionEtape:'recap',selectedRecipes:{rec1:2},quotidien:{patates:'needed'},quotidienQty:{patates:1},ligneQuantites:{},lignePossedees:{},choixProduits:{},drives:['carrefour'],
 extras:[{id:'x-pdt',name:'Pommes de terre bio',quantity:500,unit:'g',rayon:'fruits_legumes'}],manques:{},habitudesVues:{},doublonsValides:[]};
const offre=(id,recherche_id,drive,libelle,prix)=>({id,recherche_id,drive,libelle,marque:null,ean13:null,url:null,image_url:null,prix,prix_unitaire:null,unite_prix:null,grammage_g:null,volume_ml:null,nutriscore:null,promotion:null,disponible:true,rang:0,vu_le:maintenant});
const recherches=[{id:'rc',drive:'carrefour',requete:'Lardons',ean13:null,statut:'faite',resultats:1,demandee_le:maintenant,faite_le:maintenant,type:'recherche'},{id:'rl',drive:'leclerc',requete:'Lardons',ean13:null,statut:'faite',resultats:1,demandee_le:maintenant,faite_le:maintenant,type:'recherche'}];
const offres=[offre('c1','rc','carrefour','HERTA Lardons fumés 2x75g',2.49),offre('l1','rl','leclerc','Lardons fumés Repère 200g',1.99)];
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});let page;try{
 page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ecrit={rattache:[],produits:[]};
 await page.route(/open(food|beauty|products)facts\.org/,route=>route.fulfill({json:{products:[],count:0}}));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=decodeURIComponent(req.url().replace(/\+/g,'%20')),m=req.method();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/recipe_ingredients')&&m==='PATCH')ecrit.rattache.push({url,corps:req.postDataJSON()});
  else if(url.includes('/rest/v1/recipes'))data=recipes;
  else if(url.includes('/rest/v1/recherches_drive'))data=m!=='GET'||url.includes('statut=in.')||url.includes('or=(')||url.includes('type=eq.fiche')?[]:recherches.filter(r=>url.includes(`requete=eq.${r.requete}`));
  else if(url.includes('/rest/v1/offres_drive')){const ids=(url.match(/recherche_id=in\.\(([^)]*)\)/)||[])[1]?.split(',')??[];data=offres.filter(o=>ids.includes(o.recherche_id));}
  else if(url.includes('/rest/v1/purchase_lines')||url.includes('/rest/v1/product_equivalents'))data=[];
  else if(url.includes('/rest/v1/extension_presence'))data={vue_le:maintenant,activite:'prete',detail:{auto:true}};
  else if(url.includes('/rest/v1/products')&&m==='POST'){const c=req.postDataJSON();ecrit.produits.push(c);const p={...base,...c,id:`lardons-${ecrit.produits.length}`,category:'boucherie'};products.push(p);data=p;}
  else if(url.includes('/rest/v1/products'))data=url.includes('ean13=eq.')||url.includes('select=alternatives')?null:products;
  else if(url.includes('/functions/v1/'))data={ok:false};
  await route.fulfill({json:data});});
 await page.addInitScript(({session,id,etat})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));if(!localStorage.getItem('seeded')){localStorage.setItem('tablee-maison-v1:'+id,JSON.stringify(etat));localStorage.setItem('seeded','yes');}},{session,id:user.id,etat});
 const btn=(name)=>page.getByRole('button',{name,exact:true}),texte=(t)=>page.getByText(t,{exact:true});
 await page.goto(`http://localhost:${PORT}/wizard/recap`);await texte('Étape 2 sur 2 · Bilan').waitFor({timeout:60000});
 // Le bilan : les ingrédients sans produit ont leur ligne ; la liste n'est plus dépliable ici.
 await page.getByRole('button',{name:/^Ingrédients des repas : 1 sans produit : Lardons\. Lier$/}).waitFor();
 await page.getByRole('button',{name:/^Habitudes et liste :.*repas déjà comptés/}).waitFor();
 if(await btn('Voir et ajuster la liste').count())throw Error('Liste encore dépliable au bilan');
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/br1-bilan.png'});
 // Lier : la feuille s'ouvre sur l'ingrédient, avec ses recettes ; choisir puis valider relie la recette.
 await page.getByRole('button',{name:/^Ingrédients des repas :/}).click();
 await texte('« Lardons »').waitFor();await page.getByText(/Quiche lorraine/).first().waitFor();
 await page.getByRole('radio',{name:/^HERTA Lardons/}).waitFor({timeout:20000});
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/br2-lier.png'});
 await page.getByRole('radio',{name:/^HERTA Lardons/}).click();await page.getByRole('radio',{name:/^Lardons fumés Repère/}).click();
 await btn('Valider les 2 produits').click();
 // Le point suivant est le doublon : les noms se lisent, « Retirer les deux » existe.
 await texte('Le même achat, noté deux fois ?').waitFor();await page.getByText('Pommes de terre bio',{exact:true}).first().waitFor();
 if(!ecrit.rattache.some(r=>r.url.includes('id=eq.i-lardons')&&r.corps.product_id))throw Error('Ingrédient pas relié à la recette '+JSON.stringify(ecrit.rattache));
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/br3-doublon.png'});
 await btn('Retirer Pommes de terre et Pommes de terre bio de ta liste').click();
 await texte('Tout est réglé').waitFor();await btn('Terminer').click();
 // Habitudes et liste : les œufs portent la part de la quiche ; « + » ajoute en plus.
 await page.getByRole('button',{name:/^Habitudes et liste :/}).last().click();
 await page.getByRole('tab',{name:/^Produits laitiers/}).first().click();
 // Variante B : une carte par recette, ses produits du rayon dedans.
 await page.getByRole('heading',{name:/^Quiche lorraine, 2 personnes, \d+ produits? dans ce rayon$/}).first().waitFor();
 await page.getByRole('button',{name:'Augmenter Œufs Plein Air x6, en plus des 2 pour les repas'}).click();
 await texte('+1 en plus des repas').waitFor();
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/br4-habitudes.png'});
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);await page?.screenshot({path:dossier+'/br-erreur.png'}).catch(()=>{});process.exitCode=1}finally{await b.close()}})();
