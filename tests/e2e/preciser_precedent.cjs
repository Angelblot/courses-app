/* Préciser : le chevron « Précédent » revoit un point réglé, « Changer » le rouvre, « Continuer » ramène à la file. */
const {chromium}=require('playwright');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:false,image_url:null,volume_ml:null,nutriscore:null,grammage_g:null,alternatives:[],vendu_chez:null,phrases_siri:[]};
const products=[{...base,id:'lait',name:'Lait demi-écrémé',ean13:'3000000000001',brand:'Lactel',product_type:'lait',category:'pls'}];
const dossier=process.env.CAPTURES||'/tmp';
const extra=(id,name)=>({id,name,quantity:1,unit:'unité',rayon:'autre'});
const etat={quotidien:{},quotidienQty:{},ligneQuantites:{},lignePossedees:{},selectedRecipes:{},choixProduits:{},drives:['carrefour'],
 extras:[extra('rappel-a','Antikal'),extra('rappel-s','Sel regenerant'),extra('rappel-j','Javel')],
 manques:{'extra:rappel-a':{name:'Antikal',source:'rappels'},'extra:rappel-s':{name:'Sel regenerant',source:'rappels'},'extra:rappel-j':{name:'Javel',source:'rappels'}},importsExternes:['rappel:a','rappel:s','rappel:j']};
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});let page;try{
 page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://world.openfoodfacts.org/**',route=>route.fulfill({json:{products:[],count:0}}));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=req.url();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/products'))data=url.includes('ean13=eq.')?null:products;
  else if(url.includes('/functions/v1/'))data={ok:false};
  await route.fulfill({json:data});});
 await page.addInitScript(({session,id,etat})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));if(!localStorage.getItem('seeded')){localStorage.setItem('tablee-maison-v1:'+id,JSON.stringify(etat));localStorage.setItem('seeded','yes');}},{session,id:user.id,etat});
 const btn=(name)=>page.getByRole('button',{name,exact:true});
 const texte=(t)=>page.getByText(t,{exact:true});
 const garder=(nom)=>btn(`Garder « ${nom} » sans produit. L’extension le cherchera par son nom.`);
 await page.goto('http://localhost:8082');await btn('Préparer mes courses').waitFor({timeout:60000});
 await btn('Préparer mes courses').click();await btn('Voir le bilan').click();
 await page.getByRole('button',{name:/^Manques :.*Préciser$/}).last().click();
 await texte('Préciser · 1 sur 3').waitFor();await texte('« Antikal »').waitFor();
 // Au premier point, le chevron est là mais inactif.
 if(!(await page.getByRole('button',{name:/^(Point précédent|Revenir à «)/}).isDisabled()))throw Error('Chevron actif au premier point');
 await garder('Antikal').click();
 await texte('Préciser · 2 sur 3').waitFor();await texte('« Sel regenerant »').waitFor();
 await page.waitForTimeout(500);await page.screenshot({path:dossier+'/pp1-point2.png'});
 // Retour au point réglé : son résumé, sans rien rouvrir.
 await page.getByRole('button',{name:/^(Point précédent|Revenir à «)/}).click();
 await texte('Déjà réglé').waitFor();await texte('« Antikal »').waitFor();await texte('Préciser · 1 sur 3').waitFor();
 await texte('sans produit, cherché par son nom').waitFor();
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/pp2-regle.png'});
 // Continuer ramène à la tête de file.
 await btn('Continuer au point 2, « Sel regenerant »').click();await texte('« Sel regenerant »').waitFor();
 // Retirer, revenir, changer : la ligne revient et le point se rouvre.
 await btn('Retirer Sel regenerant de ta liste').click();
 await texte('Préciser · 3 sur 3').waitFor();await texte('« Javel »').waitFor();
 await page.getByRole('button',{name:/^(Point précédent|Revenir à «)/}).click();await texte('Déjà réglé').waitFor();await texte('Retiré').waitFor();
 await page.getByRole('button',{name:/^(Point précédent|Revenir à «)/}).click();await texte('« Antikal »').waitFor();await texte('Préciser · 1 sur 3').waitFor();
 await btn('Changer « Antikal »').click();
 await texte('« Antikal »').waitFor();await garder('Antikal').waitFor();
 if(await texte('Déjà réglé').count())throw Error('Antikal pas rouvert');
 await page.waitForTimeout(500);await page.screenshot({path:dossier+'/pp3-rouvert.png'});
 // Régler à nouveau : on repart vers le premier point ouvert (Sel est retiré, Javel reste).
 await garder('Antikal').click();await texte('« Javel »').waitFor();await texte('Préciser · 3 sur 3').waitFor();
 // Le dernier point réglé : la feuille reste ouverte sur le récapitulatif.
 await garder('Javel').click();
 await texte('Tout est réglé').waitFor();await texte('3 points. Touche-en un pour le revoir.').waitFor();
 await texte('Retiré de ta liste').waitFor();
 await page.waitForTimeout(500);await page.screenshot({path:dossier+'/pp4-fin.png'});
 await page.getByRole('button',{name:/^Revoir « Javel »/}).click();
 await texte('Déjà réglé').waitFor();await texte('« Javel »').waitFor();
 await btn('Voir le récapitulatif').click();await texte('Tout est réglé').waitFor();
 await page.getByRole('button',{name:/^Revenir à « Javel »/}).click();await texte('Déjà réglé').waitFor();
 await btn('Voir le récapitulatif').click();await btn('Terminer').click();
 await texte('Tout est réglé').waitFor({state:'detached'});
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);await page?.screenshot({path:dossier+'/pp-erreur.png'}).catch(()=>{});process.exitCode=1}finally{await b.close()}})();
