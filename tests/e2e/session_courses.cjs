const {chromium}=require('playwright');const fs=require('fs');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const products=[{id:'beurre',name:'Beurre doux',ean13:'1234567890126',unit:'unité',brand:null,category:'pls',favorite:true,image_url:null,grammage_g:250,volume_ml:null,product_type:'beurre'},{id:'oeufs',name:'Œufs Plein Air',ean13:'1234567890123',unit:'unité',brand:'Plein air',category:'pls',favorite:true,image_url:null,grammage_g:null,volume_ml:null,product_type:'oeuf'},{id:'patates',name:'Pommes de terre',ean13:'1234567890124',unit:'unité',brand:null,category:'fruits_legumes',favorite:true,image_url:null,grammage_g:1000,volume_ml:null,product_type:'pomme_de_terre'},{id:'oignons',name:'Oignons jaunes',ean13:'1234567890125',unit:'unité',brand:null,category:'fruits_legumes',favorite:true,image_url:null,grammage_g:500,volume_ml:null,product_type:'oignon'},{id:'lessive',name:'Lessive liquide',ean13:'1234567890127',unit:'unité',brand:'Le Chat',category:'entretien',favorite:false,image_url:null,grammage_g:null,volume_ml:2000,product_type:null}];
const recipes=[{id:'rec1',name:'Poulet rôti aux légumes',servings_default:2,image_url:null,prep_minutes:15,cook_minutes:40,recipe_ingredients:[{id:'ing',name:'Pommes de terre',quantity_per_serving:300,unit:'g',rayon:'fruits_legumes',product_id:'patates'}]}];
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));let sent,coupures=2,horsLigne=true,envois=0;const ids=[];
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=req.url();let data=[];if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;else if(url.includes('/rest/v1/products'))data=products;else if(url.includes('/rest/v1/recipes'))data=recipes;else if(url.includes('/rest/v1/cart_jobs')&&req.method()==='POST'){sent=req.postDataJSON();ids.push(sent.id);envois++;if(coupures>0){coupures--;return route.abort('failed');}data=[];}else if(url.includes('/rest/v1/cart_jobs')&&url.includes('id=eq.')){if(horsLigne)return route.abort('failed');data=[];}await route.fulfill({json:data});});
 await page.addInitScript(({session,id})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));if(!localStorage.getItem('seeded-session')){localStorage.setItem('tablee-maison-v1:'+id,JSON.stringify({quotidien:{oeufs:'needed',patates:'needed'},quotidienQty:{oeufs:1,patates:2},extras:[{id:'siri-lessive',name:'lessive',quantity:1,unit:'unité',rayon:'autre'}],manques:{'produit:oeufs':{name:'Œufs Plein Air',source:'widget'},'produit:patates':{name:'Pommes de terre',source:'widget'},'extra:siri-lessive':{name:'lessive',source:'siri'}}}));localStorage.setItem('seeded-session','yes');}}, {session,id:user.id});
 const dir=process.env.CAPTURES||'.impeccable/review/session-courses';fs.mkdirSync(dir,{recursive:true});const shot=n=>page.screenshot({path:`${dir}/${n}.png`});
 const btn=(name)=>page.getByRole('button',{name,exact:true});
 const texte=t=>page.getByText(t,{exact:true}).last();
 await page.goto('http://localhost:8082');await page.getByText('Les courses, à ton rythme.',{exact:true}).waitFor({timeout:60000});
 // Accueil : lignes touchables, « Tout voir » en titre.
 if(await btn('Voir mes manques').count())throw Error('Duplicate home button remains');
 await btn('Tout voir, 3 produits').waitFor();await btn('Noter un manque…').waitFor();
 await shot('0-accueil');
 // Étape 1 sur 2 : les repas ; la photo ouvre un aperçu sans quitter la session.
 await btn('Préparer mes courses').click();await texte('Étape 1 sur 2 · Repas').waitFor();
 if(await page.getByRole('tab',{name:/Réglages/}).count()||await btn('Réglages').count())throw Error('Tab bar or avatar visible in session');
 await btn('Voir la recette Poulet rôti aux légumes').click();await btn('Choisir ce repas').click();await btn('Retirer de mes repas').waitFor();
 await btn('1 repas choisi, les revoir').waitFor();await shot('1-repas');
 await btn('Voir le bilan').click();await texte('Étape 2 sur 2 · Bilan').waitFor();
 // Étape 2 sur 2 : le bilan, avec ses corrections ; rien ne bloque sauf les vrais problèmes.
 await btn('Manques : 3 notés · « lessive » : l’extension cherchera ce nom. Préciser').waitFor();await btn('Habitudes : Pas encore revues · 2 produits. Revoir').waitFor();
 await shot('2-bilan');
 // Le retour du pied ramène aux repas, « Voir le bilan » au bilan.
 await btn('Revenir à l’étape Repas').last().click();await texte('Étape 1 sur 2 · Repas').waitFor();await btn('Voir le bilan').last().click();await texte('Étape 2 sur 2 · Bilan').waitFor();
 // Correction Manques : produits du catalogue prêts, « lessive » à préciser plus tard.
 // B1 : la ligne Manques ouvre directement la feuille ; on peut la refermer sans rien trancher.
 await btn('Manques : 3 notés · « lessive » : l’extension cherchera ce nom. Préciser').last().click();await page.getByRole('dialog',{name:'Préciser « lessive »'}).waitFor();await page.waitForTimeout(700);await shot('3-verifier');
 // F2 : la feuille ouvre sur les produits proches du mot noté.
 await btn('Choisir : Lessive liquide, Le Chat · 2000 ml').waitFor();
 await page.getByRole('dialog',{name:'Préciser « lessive »'}).getByRole('button',{name:'Fermer',exact:true}).click();await page.waitForTimeout(500);
 // Pause : abandonner s'annule depuis l'accueil, puis on reprend au bilan.
 await btn('Faire une pause').last().click();await btn('Abandonner ces courses').click();
 await btn('Annuler : Courses abandonnées. Tes manques restent notés.').click();
 await btn('Reprendre mes courses').click();await texte('Étape 2 sur 2 · Bilan').waitFor();
 await btn('Faire une pause').last().click();await btn('Finir plus tard').click();await page.reload();await btn('Reprendre mes courses').click();await texte('Étape 2 sur 2 · Bilan').waitFor();
 // Correction Habitudes : liste à cocher par rayon, choix gardés d'un rayon à l'autre, rayon annulable.
 await btn('Habitudes : Pas encore revues · 2 produits. Revoir').last().click();
 const oignons=page.getByRole('checkbox',{name:'Oignons jaunes'}).last();await oignons.waitFor();
 await oignons.click();if(!await oignons.isChecked())throw Error('Habit row not checked');
 await page.getByRole('tab',{name:'Produits laitiers'}).last().click();await page.getByRole('checkbox',{name:'Beurre doux'}).last().waitFor();
 await page.getByRole('tab',{name:'Fruits & légumes'}).last().click();if(!await oignons.isChecked())throw Error('Habit choice lost when switching aisle');
 // Quitter par « ‹ Bilan » sans valider ne perd pas non plus la coche.
 await btn('Revenir au bilan').first().click();await texte('Étape 2 sur 2 · Bilan').waitFor();
 // Cocher, c'est déjà ajouter à la liste : le bilan compte la coche sans « Rayon suivant ».
 await btn('Habitudes : 1 rayon sur 2 revu · 1 retenu. Continuer').waitFor();
 await page.getByRole('button',{name:/^Habitudes :/}).last().click();await oignons.waitFor();if(!await oignons.isChecked())throw Error('Habit choice lost when leaving to the bilan');
 await shot('4-habitudes');
 await btn('Rayon suivant · 1 retenu').click();await page.getByRole('checkbox',{name:'Beurre doux'}).last().waitFor();
 await btn('Annuler : Fruits & légumes : 1 retenu').click();await oignons.waitFor();
 // Annuler le rayon défait le classement du reste, pas la coche.
 if(!await oignons.isChecked())throw Error('Undo removed the checked habit');
 await btn('Rayon suivant · 1 retenu').click();await page.getByRole('checkbox',{name:'Beurre doux'}).last().waitFor();
 await btn('Revenir au bilan').last().click();await btn('Habitudes : 1 retenu sur 2').waitFor();
 // Correction Extras : une ligne proche existe ; on peut l'augmenter (annulable) ou noter à part.
 await btn('Extras : Un produit hors habitudes').last().click();
 const champ=page.getByRole('textbox',{name:'Produit manquant',exact:true}).last();await champ.fill('Pommes de terre bio');
 await texte('Déjà dans ta liste').waitFor();await shot('5-extras-similaire');
 if(await texte('Nombre d’articles').count())throw Error('Lone quantity stepper shown next to a similar line');
 await btn('1 de plus : Pommes de terre, passer à 3').click();await btn('Annuler : Pommes de terre : 2 → 3').click();
 await champ.fill('Pommes de terre bio');await btn('Noter à part : Pommes de terre bio').click();
 await texte('1 × Pommes de terre bio').waitFor();
 await btn('Retirer Pommes de terre bio').click();await btn('Annuler : Pommes de terre bio retiré de ta liste').click();await texte('1 × Pommes de terre bio').waitFor();
 await btn('Revenir au bilan').last().click();await btn('Extras : 1 ajouté').waitFor();
 // Noté à part : pas redemandé comme doublon. Il reste la lessive à préciser.
 // U2 : rien ne bloque l'envoi ; la lessive partirait telle quelle, et la ligne Manques propose de la préciser.
 const preciser=btn('Manques : 3 notés · « lessive » : l’extension cherchera ce nom. Préciser');await preciser.waitFor();
 if(!await btn('Envoyer au drive').last().isEnabled())throw Error('Send blocked by a free-label item');
 await texte('dont 2 cherchés par leur nom').waitFor();
 if(await page.getByText(/chose.? à vérifier/).count())throw Error('Banner still shown');
 await shot('6-bilan');
 await preciser.click();await texte('Préciser « lessive »').waitFor();await page.waitForTimeout(700);await shot('6b-verifier');
 await btn('Laisser « lessive » tel quel').click();await page.getByText('Préciser « lessive »',{exact:true}).waitFor({state:'detached'});
 await texte('produits dans ta liste').waitFor();if(!await btn('Envoyer au drive').last().isEnabled())throw Error('Send button disabled');
 await shot('6c-bilan-pret');
 await btn('Voir et ajuster la liste').last().click();await texte('Fruits & légumes').waitFor();
 // Tout retrait depuis la liste s'annule : « Déjà chez moi » et « − » à 0.
 await btn('Déjà chez moi : Pommes de terre bio').last().click();await btn('Annuler : Pommes de terre bio : déjà chez moi').click();
 await btn('Diminuer Pommes de terre bio').last().click();await btn('Annuler : Pommes de terre bio retiré de ta liste').click();
 await texte('5',{exact:true}).first().waitFor();
 await page.setViewportSize({width:1024,height:1366});await page.waitForTimeout(600);await shot('6-bilan-tablette');
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Overflow');
 await page.setViewportSize({width:390,height:844});
 // Envoi sans blocage, puis clôture qui suit l'ordinateur (W2).
 await btn('Envoyer au drive').last().click();await page.getByRole('dialog',{name:'Où fait-on les courses ?'}).waitFor();await page.waitForTimeout(700);await shot('7-envoi');
 if(!await page.getByRole('checkbox',{name:'Carrefour'}).isChecked()||await page.getByRole('checkbox',{name:'E.Leclerc'}).isChecked())throw Error('Drive checkbox state not exposed');
 if(await page.getByRole('checkbox',{name:/C’est fait/}).count())throw Error('First send still gated');
 // Hors ligne : on ne sait pas si la liste est partie. Le message vient vite,
 // et l'identifiant survit à la fermeture de la feuille.
 const t0=Date.now();await btn('Envoyer').click();
 await texte('Pas de réseau pour le moment. Réessaie : la liste ne partira pas deux fois.').waitFor();if(Date.now()-t0>5500)throw Error('Offline message too slow: '+(Date.now()-t0));
 await page.waitForTimeout(200);if(!await page.evaluate(()=>!!document.activeElement?.closest('[role=dialog]')))throw Error('Focus left the send sheet after an error');
 await page.getByRole('dialog',{name:'Où fait-on les courses ?'}).getByRole('button',{name:'Fermer',exact:true}).click();await page.waitForTimeout(500);
 horsLigne=false;await btn('Envoyer au drive').last().click();await page.waitForTimeout(700);
 // Coupure vérifiée : rien n'est parti, le message le dit ; le nouvel essai part.
 await btn('Envoyer').click();await texte('L’envoi n’a pas abouti, rien n’est parti. Réessaie.').waitFor();await btn('Envoyer').click();await texte('Liste prête pour Carrefour.').waitFor();await texte('En attente de ton ordinateur').waitFor();const aide=btn('Elle n’est pas installée ?');await aide.waitFor();if((await aide.boundingBox()).height<44)throw Error('Install help link under 44px');
 await page.waitForTimeout(800);
 // La feuille d'envoi doit être refermée sur l'écran de clôture.
 if(await page.getByText('Où fait-on les courses ?',{exact:true}).isVisible().catch(()=>false))throw Error('Send sheet still open on closing screen');
 await shot('8-envoye');
 await page.waitForTimeout(300);if(envois!==3||ids[0]!==ids[1]||ids[2]===ids[1]||!/^[0-9a-f-]{36}$/.test(ids[0]))throw Error('A send in doubt must keep its id across reopen '+JSON.stringify(ids));
 if(!sent||sent.items.length!==5||sent.items.find(x=>x.product_id==='patates')?.quantity!==2)throw Error('Incorrect consolidated payload '+JSON.stringify(sent));
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true,items:sent.items.length,errors}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
