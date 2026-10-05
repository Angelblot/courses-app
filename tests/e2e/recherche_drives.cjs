/* Chercher sur les drives (CD) : la demande, l'attente avec « Tout envoyer », les résultats par drive, le comparatif et un choix par drive. */
const {chromium}=require('playwright');
const PORT=process.env.PORT||'8082';
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:false,image_url:null,volume_ml:null,nutriscore:null,grammage_g:null,alternatives:[],vendu_chez:null,phrases_siri:[],ean13:null,brand:null};
const products=[{...base,id:'lait',name:'Lait demi-écrémé',product_type:'lait',category:'pls'}];
const dossier=process.env.CAPTURES||'/tmp';
const etat={quotidien:{},quotidienQty:{},ligneQuantites:{},lignePossedees:{},selectedRecipes:{},choixProduits:{},drives:['carrefour','leclerc'],
 extras:[{id:'rappel-p',name:'Papier sulfurisé',quantity:1,unit:'unité',rayon:'autre'},{id:'rappel-g',name:'Gel intime',quantity:1,unit:'unité',rayon:'autre'}],
 manques:{'extra:rappel-p':{name:'Papier sulfurisé',source:'rappels'},'extra:rappel-g':{name:'Gel intime',source:'rappels'}},importsExternes:['rappel:p','rappel:g']};
const offre=(id,drive,rang,libelle,prix,ean13=null,extra={})=>({id,recherche_id:drive==='carrefour'?'rc':'rl',drive,libelle,marque:null,ean13,url:ean13?`https://www.carrefour.fr/p/x-${ean13}`:null,image_url:null,
 prix,prix_unitaire:null,unite_prix:null,grammage_g:null,volume_ml:null,nutriscore:null,promotion:null,disponible:true,rang,vu_le:new Date().toISOString(),...extra});
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let recherches=[],offres=[];const ecrit={recherches:[],produits:[],majProduits:[],liens:[]};
 await page.route(/open(food|beauty|products)facts\.org/,route=>route.fulfill({json:{products:[],count:0}}));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=decodeURIComponent(req.url().replace(/\+/g,'%20')),m=req.method();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/recherches_drive')){
   if(m==='POST'){const lignes=req.postDataJSON();ecrit.recherches.push(...lignes);recherches.push(...lignes.map((l,i)=>({id:`r${recherches.length+i}`,statut:'en_attente',resultats:null,demandee_le:new Date().toISOString(),faite_le:null,...l})));}
   else if(m==='DELETE')recherches=[];
   else data=url.includes('statut=in.')?recherches.filter(r=>['en_attente','en_cours','verification'].includes(r.statut)):recherches.filter(r=>url.includes(`requete=eq.${r.requete}`));}
  else if(url.includes('/rest/v1/offres_drive'))data=offres;
  else if(url.includes('/rest/v1/extension_presence'))data={vue_le:new Date().toISOString(),activite:'prete',detail:{auto:true}};
  else if(url.includes('/rest/v1/products')&&m==='POST'){const c=req.postDataJSON();const p={...base,...c,id:`cree-${ecrit.produits.length}`};ecrit.produits.push(c);products.push(p);data=p;}
  else if(url.includes('/rest/v1/products')&&m==='PATCH'){ecrit.majProduits.push({url,corps:req.postDataJSON()});}
  else if(url.includes('/rest/v1/product_equivalents')&&m==='POST'){ecrit.liens.push(req.postDataJSON());}
  else if(url.includes('/rest/v1/products'))data=url.includes('ean13=eq.')?null:products;
  else if(url.includes('/functions/v1/'))data={ok:false};
  await route.fulfill({json:data});});
 await page.addInitScript(({session,id,etat})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));if(!localStorage.getItem('seeded')){localStorage.setItem('tablee-maison-v1:'+id,JSON.stringify(etat));localStorage.setItem('seeded','yes');}},{session,id:user.id,etat});
 const btn=(name)=>page.getByRole('button',{name,exact:true});
 const ouvrir=async()=>{await page.getByRole('button',{name:/^Manques :.*Préciser$/}).last().click();await page.getByText('« Papier sulfurisé »',{exact:true}).waitFor();};
 await page.goto(`http://localhost:${PORT}`);await btn('Préparer mes courses').waitFor({timeout:60000});
 await btn('Préparer mes courses').click();await btn('Voir le bilan').click();await ouvrir();
 // 1. Rien demandé : l'encart propose la recherche sur les deux drives.
 const chercher=btn('Chercher sur Carrefour et E.Leclerc');await chercher.waitFor({timeout:20000});await chercher.scrollIntoViewIfNeeded();
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/cd1-encart.png'});
 await chercher.click();
 // 2. Envoyée : une recherche par drive, l'état de chacun, et « Tout envoyer » pour l'autre point.
 await page.getByText('Recherche envoyée',{exact:true}).waitFor();
 const deux=JSON.stringify(ecrit.recherches.map(r=>[r.drive,r.requete]));
 if(deux!==JSON.stringify([['carrefour','Papier sulfurisé'],['leclerc','Papier sulfurisé']]))throw Error('Mauvaises recherches '+deux);
 if(await page.getByText('pas encore lancée',{exact:true}).count()!==2)throw Error('États des drives absents');
 await btn('Chercher aussi les 1 autres points sur les drives').click();
 await page.getByText('Les autres sont envoyés aussi',{exact:true}).waitFor();
 if(ecrit.recherches.length!==4||ecrit.recherches[3].requete!=='Gel intime')throw Error('Lot mal envoyé '+JSON.stringify(ecrit.recherches));
 // Le pied dit où en est l'extension (vue il y a un instant, prête) et propose de passer au suivant.
 await page.getByText('Chrome est ouvert',{exact:true}).waitFor();
 await page.getByText('Les recherches partent d’elles-mêmes dans les 30 secondes.',{exact:true}).waitFor();
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/cd2-attente.png'});
 await btn('Passer au suivant').click();await page.getByText('« Gel intime »',{exact:true}).waitFor();
 await btn('Passer au suivant').click();await page.getByText('« Papier sulfurisé »',{exact:true}).waitFor();
 // 3. L'extension a cherché : les résultats reviennent, par drive.
 recherches=recherches.map(r=>r.requete!=='Papier sulfurisé'?r:{...r,id:r.drive==='carrefour'?'rc':'rl',statut:'faite',resultats:r.drive==='carrefour'?4:1,faite_le:new Date().toISOString()});
 offres=[offre('c1','carrefour',0,'Papier cuisson sulfurisé Carrefour 8 m',1.59,'3560070000001'),offre('c2','carrefour',1,'Papier cuisson Albal 10 m',2.99,'3560070000002'),
  offre('c3','carrefour',2,'Papier sulfurisé Bio 5 m',2.49),offre('c4','carrefour',3,'Feuilles de cuisson x20',3.19),offre('l1','leclerc',0,'Papier cuisson Repère 8 m',1.39,null,{promotion:'-30 % le 2e'})];
 await page.keyboard.press('Escape');await page.waitForTimeout(600);await ouvrir();
 await page.getByText('Sur tes drives',{exact:true}).waitFor({timeout:20000});
 // Quatre résultats Carrefour : tous montrés plutôt qu'un « Voir 1 autre ».
 await page.getByText('Feuilles de cuisson x20',{exact:true}).waitFor();if(await page.getByText(/^Voir les/).count())throw Error('Voir les autres inutile');
 await page.getByRole('checkbox',{name:'Comparer Papier cuisson sulfurisé Carrefour 8 m'}).click();
 await page.getByRole('checkbox',{name:'Comparer Papier cuisson Albal 10 m'}).click();
 await page.getByRole('checkbox',{name:'Comparer Papier cuisson Repère 8 m'}).click();
 const comparer=page.getByRole('button',{name:'Comparer les 3 produits cochés'});await comparer.scrollIntoViewIfNeeded();
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/cd3-resultats.png'});
 await comparer.click();
 // 4. Comparatif : un choix par drive ; un 2e choix Carrefour remplace le 1er.
 await page.getByText('Choisis un produit par drive, ou un seul pour les deux.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Choisir Papier cuisson sulfurisé Carrefour 8 m pour Carrefour'}).click();
 await page.getByRole('button',{name:'Choisir Papier cuisson Albal 10 m pour Carrefour'}).click();
 if(await page.getByRole('button',{name:'Retirer le choix de Papier cuisson sulfurisé Carrefour 8 m pour Carrefour'}).count())throw Error('Deux choix Carrefour');
 await page.getByRole('button',{name:'Choisir Papier cuisson Repère 8 m pour E.Leclerc'}).click();
 await btn('Garder ces 2 produits').waitFor();
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/cd4-comparer.png'});
 await btn('Garder ces 2 produits').click();
 // 5. Deux produits, chacun réservé à son drive, l'un alternative de l'autre ; le point suivant arrive.
 await page.getByText('« Gel intime »',{exact:true}).waitFor({timeout:20000});
 const crees=JSON.stringify(ecrit.produits.map(p=>[p.name,p.vendu_chez,p.ean13]));
 if(crees!==JSON.stringify([['Papier cuisson Albal 10 m','carrefour','3560070000002'],['Papier cuisson Repère 8 m','leclerc',null]]))throw Error('Produits '+crees);
 const alt=ecrit.majProduits.find(x=>x.corps.alternatives);if(!alt||!alt.url.includes('id=eq.cree-0')||JSON.stringify(alt.corps.alternatives)!=='["cree-1"]')throw Error('Alternatives '+JSON.stringify(ecrit.majProduits));
 const liens=JSON.stringify(ecrit.liens.map(l=>[l.drive,l.matched_label,l.product_url]));
 if(liens!==JSON.stringify([['carrefour','Papier cuisson Albal 10 m','https://www.carrefour.fr/p/x-3560070000002'],['leclerc','Papier cuisson Repère 8 m',null]]))throw Error('Liens '+liens);
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
