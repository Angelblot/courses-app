const {chromium}=require('playwright');const fs=require('fs');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const products=[{id:'beurre',name:'Beurre doux',ean13:'1234567890126',unit:'unité',brand:null,category:'pls',favorite:true,image_url:null,grammage_g:250,volume_ml:null,product_type:'beurre'},{id:'oeufs',name:'Œufs Plein Air',ean13:'1234567890123',unit:'unité',brand:'Plein air',category:'pls',favorite:true,image_url:null,grammage_g:null,volume_ml:null,product_type:'oeuf'},{id:'patates',name:'Pommes de terre',ean13:'1234567890124',unit:'unité',brand:null,category:'fruits_legumes',favorite:true,image_url:null,grammage_g:1000,volume_ml:null,product_type:'pomme_de_terre'},{id:'oignons',name:'Oignons jaunes',ean13:'1234567890125',unit:'unité',brand:null,category:'fruits_legumes',favorite:true,image_url:null,grammage_g:500,volume_ml:null,product_type:'oignon'}];
const recipes=[{id:'rec1',name:'Poulet rôti aux légumes',servings_default:2,image_url:null,prep_minutes:15,cook_minutes:40,recipe_ingredients:[{id:'ing',name:'Pommes de terre',quantity_per_serving:300,unit:'g',rayon:'fruits_legumes',product_id:'patates'}]}];
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));let sent;
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=req.url();let data=[];if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;else if(url.includes('/rest/v1/products'))data=products;else if(url.includes('/rest/v1/recipes'))data=recipes;else if(url.includes('/rest/v1/cart_jobs')&&req.method()==='POST'){sent=req.postDataJSON();data={id:'job-demo'};}await route.fulfill({json:data});});
 await page.addInitScript(({session,id})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));if(!localStorage.getItem('seeded-session')){localStorage.setItem('tablee-maison-v1:'+id,JSON.stringify({quotidien:{oeufs:'needed',patates:'needed'},quotidienQty:{oeufs:1,patates:2},extras:[{id:'siri-lessive',name:'lessive',quantity:1,unit:'unité',rayon:'autre'}],manques:{'produit:oeufs':{name:'Œufs Plein Air',source:'widget'},'produit:patates':{name:'Pommes de terre',source:'widget'},'extra:siri-lessive':{name:'lessive',source:'siri'}}}));localStorage.setItem('seeded-session','yes');}}, {session,id:user.id});
 const dir=process.env.CAPTURES||'.impeccable/review/session-courses';fs.mkdirSync(dir,{recursive:true});const shot=n=>page.screenshot({path:`${dir}/${n}.png`});
 const btn=(name)=>page.getByRole('button',{name,exact:true});
 const visible=async(loc,msg)=>{const b=await loc.boundingBox();if(!b||b.y<0||b.y+b.height>844)throw Error(msg+' '+JSON.stringify(b));};
 await page.goto('http://localhost:8082');await page.getByText('Les courses, à ton rythme.',{exact:true}).waitFor({timeout:60000});
 // Accueil A1 : lignes touchables, « Tout voir » en titre, plus de boutons sous la liste.
 if(await btn('Voir mes manques').count())throw Error('Duplicate home button remains');
 await btn('Tout voir, 3 produits').waitFor();await btn('Noter un manque…').waitFor();
 await shot('0-accueil');
 await btn('Préparer mes courses').click();
 // S : la photo d'une recette ouvre un aperçu sans quitter la session.
 await btn('Voir la recette Poulet rôti aux légumes').click();await btn('Choisir ce repas').click();await btn('Retirer de mes repas').waitFor();
 // En-tête E1, sans barre d'onglets ni avatar.
 await page.getByText('Étape 1 sur 5 · Repas',{exact:true}).waitFor();
 if(await page.getByRole('tab',{name:/Réglages/}).count()||await btn('Réglages').count())throw Error('Tab bar or avatar visible in session');
 if(await btn('Revoir mes choix').count())throw Error('Duplicate review button remains');
 await btn('1 repas choisi, les revoir').waitFor();
 await shot('1-repas');
 await btn('Vérifier mes manques').click();await page.getByText('Mes manques',{exact:true}).last().waitFor();
 // Manques M : les produits du catalogue sont prêts, seule « lessive » attend.
 await page.getByText('« lessive » reste à préciser, maintenant ou au bilan.',{exact:true}).waitFor();
 if(!await btn('Continuer · 2 prêts, 1 à préciser').isEnabled())throw Error('Ready missing products block the session');
 await shot('2-manques');
 // AA : la pause ouvre une feuille ; abandonner s'annule depuis l'accueil.
 await btn('Faire une pause').click();await btn('Abandonner ces courses').click();
 await btn('Annuler : Courses abandonnées. Tes manques restent notés.').click();
 await btn('Reprendre mes courses').waitFor();await btn('Reprendre mes courses').click();
 await btn('Faire une pause').last().click();await btn('Finir plus tard').click();await page.reload();await btn('Reprendre mes courses').click();
 await btn('Continuer · 2 prêts, 1 à préciser').click();
 // HB : une liste à cocher par rayon ; le reste du rayon est « déjà chez moi ».
 const oignons=page.getByRole('checkbox',{name:'Oignons jaunes'}).last();await oignons.waitFor();
 await shot('3-habitudes');
 await oignons.click();if(!await oignons.isChecked())throw Error('Habit row not checked');
 await btn('Rayon suivant · 1 retenu').click();await page.getByRole('checkbox',{name:'Beurre doux'}).last().waitFor();
 // Un rayon validé s'annule : on revient au rayon, décisions défaites.
 await btn('Annuler : Fruits & légumes : 1 retenu').click();await oignons.waitFor();
 if(await oignons.isChecked())throw Error('Undo did not restore the aisle');
 await oignons.click();await btn('Rayon suivant · 1 retenu').click();await page.getByRole('checkbox',{name:'Beurre doux'}).last().waitFor();
 await shot('3b-habitudes-annuler');
 await btn('Continuer vers les extras').last().click();
 // Le retour mène à l'étape d'avant, jamais plus loin.
 await btn('Revenir à l’étape Habitudes').last().click();await page.getByText('Étape 3 sur 5 · Habitudes',{exact:true}).last().waitFor();
 await btn('Continuer vers les extras').last().click();await page.getByText('Étape 4 sur 5 · Extras',{exact:true}).last().waitFor();
 // X2 : un champ, le reste apparaît avec la saisie.
 if(await btn('Noter « »').count())throw Error('Empty note button shown');
 await page.getByRole('textbox',{name:'Produit manquant',exact:true}).last().fill('Pommes de terre bio');
 // DB : la ligne déjà listée remonte en tête, avec son compteur.
 await page.getByText('Déjà dans ta liste',{exact:true}).last().waitFor();await btn('Augmenter Pommes de terre').last().waitFor();await shot('4b-extras-similaire');
 await btn('Noter « Pommes de terre bio »').click();
 await page.getByText('1 × Pommes de terre bio',{exact:true}).waitFor();
 // Un retrait s'annule depuis le toast.
 await btn('Retirer Pommes de terre bio').click();await btn('Annuler : Pommes de terre bio retiré de ta liste').click();await page.getByText('1 × Pommes de terre bio',{exact:true}).waitFor();
 await shot('4-extras');
 await btn('Faire le bilan de ma liste').click();
 // Z2 + R2 : le bilan annonce, un bandeau ouvre la feuille « À régler ».
 const regler=btn('2 choses à vérifier : 1 manque, 1 doublon. Vérifier');await regler.waitFor();
 if(await btn('Choisir mon drive').last().isEnabled())throw Error('Blocked list can reach drive');
 const style=await btn('Choisir mon drive').last().evaluate(el=>{const c=getComputedStyle(el);return [c.backgroundColor,c.opacity].join(' ');});
 if(style!=='rgb(236, 238, 233) 1')throw Error('Disabled button style '+style);
 await shot('5-bilan');
 await regler.click();await page.getByText('À vérifier avant l’envoi',{exact:true}).waitFor();
 await page.waitForTimeout(700);await shot('5b-regler');
 await btn('Garder 1 × lessive').click();await btn('Retirer Pommes de terre bio').last().click();
 await btn('Annuler : Pommes de terre bio retiré de ta liste').last().waitFor();
 await page.getByText('À vérifier avant l’envoi',{exact:true}).waitFor({state:'detached'});
 await page.getByText('articles prêts',{exact:true}).last().waitFor();
 if(!await btn('Choisir mon drive').last().isEnabled())throw Error('Settled list still blocked');
 await shot('5c-bilan-pret');
 await btn('Voir et ajuster la liste').last().click();await page.getByText('Fruits & légumes',{exact:true}).last().waitFor();
 await page.setViewportSize({width:1024,height:1366});await shot('5-bilan-tablette');
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Overflow');
 await page.setViewportSize({width:390,height:844});
 // D3 : le drive se choisit dans une feuille, puis C : un écran de clôture.
 await btn('Choisir mon drive').last().click();await page.getByText('Où fait-on les courses ?',{exact:true}).waitFor();await page.waitForTimeout(700);await shot('6-envoi');
 if(!await page.getByRole('checkbox',{name:'Carrefour'}).isChecked()||await page.getByRole('checkbox',{name:'E.Leclerc'}).isChecked())throw Error('Drive checkbox state not exposed');
 await page.getByRole('dialog').getByRole('button',{name:'Fermer',exact:true}).waitFor();
 await page.getByRole('checkbox',{name:'E.Leclerc'}).click();await page.getByRole('checkbox',{name:'E.Leclerc'}).click();
 // EB : l'extension n'a jamais relevé d'envoi ; il faut confirmer qu'elle est installée.
 if(await btn('Envoyer à mon ordinateur').isEnabled())throw Error('First send not gated');
 await page.getByRole('checkbox',{name:'C’est fait, l’extension est installée'}).click();
 await btn('Envoyer à mon ordinateur').click();await page.getByText('C’est envoyé.',{exact:true}).waitFor();await shot('7-envoye');
 await page.waitForTimeout(600);if(!sent||sent.items.length!==4||sent.items.find(x=>x.product_id==='patates')?.quantity!==2)throw Error('Incorrect consolidated payload '+JSON.stringify(sent));
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true,items:sent.items.length,errors}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
