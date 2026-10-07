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
 // Les bases ouvertes : rien par nom ; par code-barres, Open Products Facts connaît l'Albal.
 await page.route(/open(food|beauty|products)facts\.org/,route=>{const u=route.request().url();
  if(u.includes('openproductsfacts')&&u.includes('/product/3560070000002'))return route.fulfill({json:{status:1,product:{product_name:'Papier cuisson Albal',categories_tags:['en:baking-paper']}}});
  if(u.includes('/product/'))return route.fulfill({status:404,json:{status:0}});
  return route.fulfill({json:{products:[],count:0}});});
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=decodeURIComponent(req.url().replace(/\+/g,'%20')),m=req.method();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/recherches_drive')){
   if(m==='POST'){const lignes=req.postDataJSON();ecrit.recherches.push(...lignes);recherches.push(...lignes.map((l,i)=>({id:`r${recherches.length+i}`,statut:'en_attente',resultats:null,demandee_le:new Date().toISOString(),faite_le:null,...l})));}
   else if(m==='DELETE')recherches=[];
   else if(url.includes('type=eq.fiche')&&url.includes('statut=in.'))data=recherches.filter(r=>r.type==='fiche'&&['en_attente','en_cours','verification'].includes(r.statut)).map(r=>({offre_id:r.offre_id}));
   else if(url.includes('type=eq.fiche'))data=recherches.filter(r=>r.type==='fiche').map(r=>({offre_id:r.offre_id}));
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
 // 1-2. Dès le bilan, chaque point part sur les deux drives, sans rien toucher : Préciser s'ouvre sur l'attente.
 await page.getByText('Recherche en file',{exact:true}).waitFor({timeout:20000});
 const envoyees=JSON.stringify(ecrit.recherches.map(r=>[r.drive,r.requete]).sort());
 if(envoyees!==JSON.stringify([['carrefour','Gel intime'],['carrefour','Papier sulfurisé'],['leclerc','Gel intime'],['leclerc','Papier sulfurisé']]))throw Error('Mauvaises recherches '+envoyees);
 if(await page.getByText('en file',{exact:true}).count()!==1)throw Error('État des drives absent');
 if(await page.getByText('L’autre point aussi ?',{exact:true}).count())throw Error('« Tout envoyer » encore là');
 // Le pied dit où en est l'extension (vue il y a un instant, prête) et propose de passer au suivant.
 await page.getByText('Chrome est ouvert',{exact:true}).waitFor();
 await page.getByText('Les recherches partent d’elles-mêmes dans les 30 secondes.',{exact:true}).waitFor();
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/cd2-attente.png'});
 await btn('Passer au suivant').click();await page.getByText('« Gel intime »',{exact:true}).waitFor();
 await btn('Passer au suivant').click();await page.getByText('« Papier sulfurisé »',{exact:true}).waitFor();
 // 3. L'extension a cherché : les résultats reviennent, par drive.
 recherches=recherches.map(r=>r.requete!=='Papier sulfurisé'?r:{...r,id:r.drive==='carrefour'?'rc':'rl',statut:'faite',resultats:r.drive==='carrefour'?4:1,faite_le:new Date().toISOString()});
 offres=[offre('c1','carrefour',0,'Papier cuisson sulfurisé Carrefour 8 m',1.59,'3560070000001'),offre('c2','carrefour',1,'Papier cuisson Albal 10 m',2.99,'3560070000002'),
  offre('c3','carrefour',2,'Papier sulfurisé Bio 5 m',2.49),offre('c4','carrefour',3,'Papier cuisson 20 feuilles',3.19,'3560070000004'),offre('l1','leclerc',0,'Papier cuisson Repère 8 m',1.39,null,{promotion:'-30 % le 2e'})];
 await page.keyboard.press('Escape');await page.waitForTimeout(600);await ouvrir();
 // Variante A : un onglet par enseigne, Carrefour d'abord.
 await page.getByRole('tab',{name:'Carrefour, 4 produits'}).waitFor({timeout:20000});
 await page.getByText('Choisis ton produit Carrefour',{exact:true}).waitFor();
 // Quatre résultats : tous montrés plutôt qu'un « Voir 1 autre ».
 await page.getByText('Papier cuisson 20 feuilles',{exact:true}).waitFor();if(await page.getByText(/^Voir les/).count())throw Error('Voir les autres inutile');
 // Dès l'arrivée des résultats, les fiches des premiers produits Carrefour sont demandées (pas Leclerc : ses fiches n'ont pas d'adresse).
 await page.waitForTimeout(1500);
 const fiches=ecrit.recherches.filter(r=>r.type==='fiche').map(r=>r.offre_id).sort().join(',');
 if(fiches!=='c1,c2,c4')throw Error('Fiches demandées '+fiches);
 // L'extension lit la fiche des 20 feuilles : leur taille donne des mètres équivalents, estimés, dès la liste.
 recherches=recherches.map(r=>r.type==='fiche'?{...r,statut:'faite'}:r);
 offres=offres.map(o=>o.id==='c4'?{...o,fiche_texte:'Description | Comprend 20 feuilles de papier cuisson 38 x 42cm.'}:o);
 await page.getByText('≈ 0,38 €/m',{exact:true}).waitFor({timeout:25000});
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/cd3-resultats.png'});
 // Appui long sur un produit du drive : sa vue détaillée, avec l'enseigne et le prix, et « Choisir pour Carrefour ».
 const vingt=page.getByRole('radio',{name:/^Papier cuisson 20 feuilles,/});const rv=await vingt.boundingBox();
 await page.mouse.move(rv.x+rv.width/2,rv.y+rv.height/2);await page.mouse.down();await page.waitForTimeout(900);await page.mouse.up();
 await page.getByText(/^Carrefour · 3,19 €/).waitFor();await btn('Choisir pour Carrefour').waitFor();
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/cd3-fiche.png'});
 await btn('Fermer').last().click();await page.getByText(/^Carrefour · 3,19 €/).waitFor({state:'detached'});
 // Choisir un produit Carrefour fait passer à E.Leclerc, sans quitter le point.
 await page.getByRole('radio',{name:/^Papier cuisson Albal 10 m,/}).click();
 await page.getByText('Puis ton produit E.Leclerc',{exact:true}).waitFor();
 await page.getByRole('tab',{name:'Carrefour, choisi'}).waitFor();
 if(!(await page.getByText('« Papier sulfurisé »',{exact:true}).count()))throw Error('Le choix a fait passer au point suivant');
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/cd3-leclerc.png'});
 // 4. Le comparatif groupé : un bandeau par enseigne, le prix au mètre, un choix par enseigne.
 // Le bouton « Comparer » est en haut ; en comparaison, on coche dans une enseigne ou les deux, le choisi l'est déjà.
 await btn('Comparer des produits').click();
 await page.getByText('Coche les produits à comparer',{exact:true}).waitFor();
 await page.getByRole('checkbox',{name:/^Papier cuisson Repère 8 m,/}).click();
 await page.getByRole('tab',{name:/^Carrefour/}).click();
 await page.getByRole('checkbox',{name:/^Papier cuisson sulfurisé Carrefour 8 m,/}).click();
 await page.getByRole('checkbox',{name:/^Papier cuisson 20 feuilles,/}).click();
 await page.getByText('4 produits cochés',{exact:true}).waitFor();
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/cd3-comparaison.png'});
 // « Comparer » vit dans le pied fixe : toujours à portée, sans descendre la liste.
 await page.getByRole('button',{name:'Comparer les 4 produits cochés'}).click();
 await page.getByText('CARREFOUR',{exact:true}).waitFor();await page.getByText('à choisir',{exact:true}).last().waitFor();
 await page.getByText('Prix au mètre',{exact:true}).waitFor();await page.getByText('0,17 €/m',{exact:true}).last().waitFor();
 // La fiche Open Products Facts n'apporte que le nom : elle n'est pas citée comme source.
 await page.waitForTimeout(1500);if(await page.getByText(/Repères :/).count())throw Error('Source citée sans rien apporter');
 await page.getByRole('button',{name:'Choisir Papier cuisson sulfurisé Carrefour 8 m pour Carrefour'}).click();
 await page.getByRole('button',{name:'Choisir Papier cuisson Albal 10 m pour Carrefour'}).click();
 if(await page.getByRole('button',{name:'Ne plus choisir Papier cuisson sulfurisé Carrefour 8 m pour Carrefour'}).count())throw Error('Deux choix Carrefour');
 // Une seule enseigne choisie : le comparatif propose d'abord de choisir l'autre, valider sans elle reste un lien.
 await btn('Choisir mon produit E.Leclerc').waitFor();await btn('Valider sans E.Leclerc').waitFor();await page.waitForTimeout(300);await page.screenshot({path:dossier+'/cd4a-un-choix.png'});
 await page.getByRole('button',{name:'Choisir Papier cuisson Repère 8 m pour E.Leclerc'}).click();
 await page.getByText('E.LECLERC',{exact:true}).waitFor();if(await page.getByText('à choisir',{exact:true}).count()>1)throw Error('E.Leclerc pas marqué choisi');
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/cd4-comparer.png'});
 // Fermer revient aux cases ; « Annuler » quitte la comparaison, et le choix fait dans le comparatif se retrouve dans Préciser, qui valide.
 await btn('Fermer').last().click();await page.waitForTimeout(600);
 await page.getByText('4 produits cochés',{exact:true}).waitFor();
 await btn('Annuler').click();
 // Le pied (variante C) dit où l'on en est, et garde « Comparer » à portée.
 await page.getByText('2 produits sur 2',{exact:true}).waitFor();await page.getByText('Tout est choisi',{exact:true}).waitFor();await btn('Comparer des produits').waitFor();
 await btn('Valider les 2 produits').click();
 // 5. Deux produits, chacun réservé à son drive, l'un alternative de l'autre ; le point suivant arrive.
 await page.getByText('« Gel intime »',{exact:true}).waitFor({timeout:20000});
 const crees=JSON.stringify(ecrit.produits.map(p=>[p.name,p.vendu_chez,p.ean13]));
 if(crees!==JSON.stringify([['Papier cuisson Albal 10 m','carrefour','3560070000002'],['Papier cuisson Repère 8 m','leclerc',null]]))throw Error('Produits '+crees);
 const alt=ecrit.majProduits.find(x=>x.corps.alternatives);if(!alt||!alt.url.includes('id=eq.cree-0')||JSON.stringify(alt.corps.alternatives)!=='["cree-1"]')throw Error('Alternatives '+JSON.stringify(ecrit.majProduits));
 const liens=JSON.stringify(ecrit.liens.map(l=>[l.drive,l.matched_label,l.product_url]));
 if(liens!==JSON.stringify([['carrefour','Papier cuisson Albal 10 m','https://www.carrefour.fr/p/x-3560070000002'],['leclerc','Papier cuisson Repère 8 m',null]]))throw Error('Liens '+liens);
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
