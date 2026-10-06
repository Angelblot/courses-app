/* Préciser : « Quel type ? » à côté du nom. Les recherches partent dès le bilan (types courants sur Carrefour), toucher « IPA » filtre aussitôt, la recherche approfondie complète avec un indicateur de chargement. */
const {chromium}=require('playwright');
const PORT=process.env.PORT||'8082';
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:false,image_url:null,volume_ml:null,nutriscore:null,grammage_g:null,alternatives:[],vendu_chez:null,phrases_siri:[],ean13:null,brand:null,category:'autre'};
const products=[{...base,id:'lait',name:'Lait demi-écrémé',product_type:'lait'}];
const dossier=process.env.CAPTURES||'/tmp';
const etat={quotidien:{},quotidienQty:{},ligneQuantites:{},lignePossedees:{},selectedRecipes:{},choixProduits:{},drives:['carrefour','leclerc'],
 extras:[{id:'rappel-b',name:'Bières',quantity:1,unit:'unité',rayon:'autre'}],manques:{'extra:rappel-b':{name:'Bières',source:'rappels'}},importsExternes:['rappel:b']};
const maintenant=new Date().toISOString();
const offre=(id,recherche_id,drive,rang,libelle,prix)=>({id,recherche_id,drive,libelle,marque:null,ean13:null,url:null,image_url:null,prix,prix_unitaire:null,unite_prix:null,grammage_g:null,volume_ml:null,nutriscore:null,promotion:null,disponible:true,rang,vu_le:maintenant});
const R=(id,drive,requete,statut)=>({id,drive,requete,ean13:null,statut,resultats:null,demandee_le:maintenant,faite_le:statut==='faite'?maintenant:null,type:'recherche'});
let recherches=[R('rc','carrefour','Bières','faite'),R('rl','leclerc','Bières','faite'),R('rci','carrefour','Bière IPA','faite')];
const offres=[offre('c1','rc','carrefour',0,'LEFFE Bière Blonde D\'Abbaye 6,6% LEFFE',5.99),offre('c2','rc','carrefour',1,'LA CHARNUE Bière IPA 5,5% LA CHARNUE',2.15),offre('c3','rc','carrefour',2,'HEINEKEN Bière Blonde 5% HEINEKEN',4.49),
 offre('c4','rc','carrefour',3,'LEFFE Bière Ruby 5% LEFFE',4.2),offre('c5','rc','carrefour',4,'HOEGAARDEN Bière Blanche 4,9% HOEGAARDEN',4.9),
 offre('l1','rl','leclerc',0,'Bière Desperados Pack de 6x33cl',7.99),offre('l2','rl','leclerc',1,'Bière blanche Hilbörg 4,5%vol. - 6x25cl',3.2),
 offre('ci1','rci','carrefour',0,'LA CHARNUE Bière IPA 5,5% LA CHARNUE',2.15),offre('ci2','rci','carrefour',1,'BREWDOG Punk IPA 5,4% BREWDOG',6.95),offre('ci3','rci','carrefour',2,'BRASSERIE DU MONT BLANC Bière IPA BRASSERIE DU MONT BLANC',5.49),
 // Ce qu'un drive renvoie faute de mieux : à écarter.
 offre('ci4','rci','carrefour',3,'Escalope de poulet Le Gaulois 240g',4.25)];
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});let page;try{
 page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const demandes=[];
 await page.route(/open(food|beauty|products)facts\.org/,route=>route.fulfill({json:{products:[],count:0}}));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=decodeURIComponent(req.url().replace(/\+/g,'%20')),m=req.method();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/recherches_drive')){
   if(m==='POST'){const lignes=req.postDataJSON();demandes.push(...lignes.map(l=>`${l.drive}:${l.requete}`));
    // E.Leclerc : la recherche approfondie part et reste en cours le temps de la capture.
    recherches.push(...lignes.filter(l=>l.requete==='Bière IPA').map((l,i)=>R(`n${i}`,l.drive,l.requete,'en_cours')));}
   else if(url.includes('type=eq.fiche'))data=[];
   else if(url.includes('or=(statut.in'))data=recherches.map(r=>({requete:r.requete,drive:r.drive}));
   else if(url.includes('statut=in.'))data=recherches.filter(r=>['en_attente','en_cours'].includes(r.statut)).map(r=>({requete:r.requete,drive:r.drive}));
   else data=recherches.filter(r=>url.includes(`requete=eq.${r.requete}&`)||url.endsWith(`requete=eq.${r.requete}`));}
  else if(url.includes('/rest/v1/offres_drive')){const ids=(url.match(/recherche_id=in\.\(([^)]*)\)/)||[])[1]?.split(',')??[];data=offres.filter(o=>ids.includes(o.recherche_id));}
  else if(url.includes('/rest/v1/purchase_lines')||url.includes('/rest/v1/product_equivalents'))data=[];
  else if(url.includes('/rest/v1/extension_presence'))data={vue_le:maintenant,activite:'recherches',detail:{auto:true}};
  else if(url.includes('/rest/v1/products'))data=url.includes('ean13=eq.')?null:products;
  else if(url.includes('/functions/v1/'))data={ok:false};
  await route.fulfill({json:data});});
 await page.addInitScript(({session,id,etat})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));if(!localStorage.getItem('seeded')){localStorage.setItem('tablee-maison-v1:'+id,JSON.stringify(etat));localStorage.setItem('seeded','yes');}},{session,id:user.id,etat});
 const btn=(name)=>page.getByRole('button',{name,exact:true}),texte=(t)=>page.getByText(t,{exact:true});
 await page.goto(`http://localhost:${PORT}`);await btn('Préparer mes courses').waitFor({timeout:60000});
 await btn('Préparer mes courses').click();await btn('Voir le bilan').click();
 // Dès le bilan : les types courants partent sur Carrefour (pas sur E.Leclerc) ; « Bière IPA » Carrefour, déjà faite, ne se redemande pas.
 await page.waitForTimeout(1500);
 for(const t of ['carrefour:Bière Blonde','carrefour:Bière Blanche','carrefour:Bière Sans alcool'])if(!demandes.includes(t))throw Error('Pas préparé : '+t+' '+JSON.stringify(demandes));
 if(demandes.some(d=>d.startsWith('leclerc:Bière ')))throw Error('Types lancés chez E.Leclerc '+JSON.stringify(demandes));
 if(demandes.includes('carrefour:Bière IPA')||demandes.includes('carrefour:Bières'))throw Error('Recherche refaite '+JSON.stringify(demandes));
 await page.getByRole('button',{name:/^Manques :.*Préciser$/}).last().click();
 await btn('Quel type de Bières ?').waitFor({timeout:20000});
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/af1-point.png'});
 await btn('Quel type de Bières ?').click();
 await texte('Quel type de « Bières » ?').waitFor();await page.getByRole('button',{name:'IPA, 1 déjà trouvé'}).waitFor();
 await page.waitForTimeout(500);await page.screenshot({path:dossier+'/af2-feuille.png'});
 await page.getByRole('button',{name:'IPA, 1 déjà trouvé'}).click();
 // Filtre instantané, et les IPA de la recherche préparée chez Carrefour.
 await page.getByRole('radio',{name:/^BREWDOG Punk IPA/}).waitFor({timeout:15000});
 if(await page.getByRole('radio',{name:/^LEFFE Bière Blonde/}).count())throw Error('Filtre absent');
 if(await page.getByRole('radio',{name:/^Escalope de poulet/}).count())throw Error('Produit hors sujet affiché');
 await texte('Nouveau').first().waitFor();
 // E.Leclerc n'avait pas d'IPA : la recherche approfondie part là seulement, avec son indicateur.
 await texte('On cherche d’autres « Bière IPA »').waitFor({timeout:15000});
 if(!demandes.includes('leclerc:Bière IPA'))throw Error('Pas de recherche approfondie chez E.Leclerc '+JSON.stringify(demandes));
 await page.waitForTimeout(600);await page.screenshot({path:dossier+'/af3-filtre.png'});
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);await page?.screenshot({path:dossier+'/af-erreur.png'}).catch(()=>{});process.exitCode=1}finally{await b.close()}})();
