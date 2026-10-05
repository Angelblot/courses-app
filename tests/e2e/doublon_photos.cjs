const {chromium}=require('playwright');const fs=require('fs');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const products=[{id:'beurre',name:'Beurre doux',ean13:'1234567890126',unit:'unité',brand:null,category:'pls',favorite:true,image_url:null,grammage_g:250,volume_ml:null,product_type:'beurre'},{id:'oeufs',name:'Œufs Plein Air',ean13:'1234567890123',unit:'unité',brand:'Plein air',category:'pls',favorite:true,image_url:null,grammage_g:null,volume_ml:null,product_type:'oeuf'},{id:'patates',name:'Pommes de terre',ean13:'1234567890124',unit:'unité',brand:null,category:'fruits_legumes',favorite:true,image_url:null,grammage_g:1000,volume_ml:null,product_type:'pomme_de_terre'},{id:'oignons',name:'Oignons jaunes',ean13:'1234567890125',unit:'unité',brand:null,category:'fruits_legumes',favorite:true,image_url:null,grammage_g:500,volume_ml:null,product_type:'oignon'},{id:'lessive',name:'Lessive liquide',ean13:'1234567890127',unit:'unité',brand:'Le Chat',category:'entretien',favorite:false,image_url:null,grammage_g:null,volume_ml:2000,product_type:null}];
const recipes=[{id:'rec1',name:'Poulet rôti aux légumes',servings_default:2,image_url:null,prep_minutes:15,cook_minutes:40,recipe_ingredients:[{id:'ing',name:'Pommes de terre',quantity_per_serving:300,unit:'g',rayon:'fruits_legumes',product_id:'patates'}]}];
// Image renvoyée par la fonction image-produit simulée : un pixel PNG.
const IMAGE='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';const demandesImage=[];
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));let sent,coupures=2,horsLigne=true,envois=0;const ids=[];
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=req.url();let data=[];if(url.includes('/functions/v1/image-produit')){demandesImage.push(req.postDataJSON().nom);return route.fulfill({json:{ok:true,url:IMAGE,source:'generee'}});}if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;else if(url.includes('/rest/v1/products'))data=products;else if(url.includes('/rest/v1/recipes'))data=recipes;else if(url.includes('/rest/v1/cart_jobs')&&req.method()==='POST'){sent=req.postDataJSON();ids.push(sent.id);envois++;if(coupures>0){coupures--;return route.abort('failed');}data=[];}else if(url.includes('/rest/v1/cart_jobs')&&url.includes('id=eq.')){if(horsLigne)return route.abort('failed');data=[];}await route.fulfill({json:data});});
 await page.addInitScript(({session,id})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));if(!localStorage.getItem('seeded-doublon')){localStorage.setItem('tablee-maison-v1:'+id,JSON.stringify({quotidien:{oeufs:'needed',patates:'needed'},quotidienQty:{oeufs:1,patates:2},extras:[{id:'siri-lessive',name:'lessive',quantity:1,unit:'unité',rayon:'autre'},{id:'pdt-bio',name:'Pommes de terre bio',quantity:1,unit:'unité',rayon:'fruits_legumes'}],manques:{'produit:oeufs':{name:'Œufs Plein Air',source:'widget'},'produit:patates':{name:'Pommes de terre',source:'widget'},'extra:siri-lessive':{name:'lessive',source:'siri'}}}));localStorage.setItem('seeded-doublon','yes');}}, {session,id:user.id});
 const dir=process.env.CAPTURES||'.impeccable/review/session-courses';fs.mkdirSync(dir,{recursive:true});const shot=n=>page.screenshot({path:`${dir}/${n}.png`});
 const btn=(name)=>page.getByRole('button',{name,exact:true});
 const texte=t=>page.getByText(t,{exact:true}).last();
 // D2 : un doublon possible se règle en touchant la photo du produit gardé.
 await page.goto('http://localhost:8082');await btn('Préparer mes courses').waitFor({timeout:60000});
 await btn('Préparer mes courses').click();await btn('Voir le bilan').click();await texte('Étape 2 sur 2 · Bilan').waitFor();
 await page.getByRole('button',{name:/^Manques :.*1 doublon possible.*Préciser$/}).last().click();
 // PR1 : un point à la fois ; le manque « lessive » vient d'abord, gardé sous son nom.
 await btn('Garder « lessive » sans produit. L’extension le cherchera par son nom.').click();
 await page.getByText('Le même achat, noté deux fois ?',{exact:true}).waitFor();await page.waitForTimeout(700);await shot('doublon');
 const garder=btn('Garder Pommes de terre, 2 articles. Pommes de terre bio sera retiré');await garder.waitFor();
 // Toujours une image : le produit noté à la main reçoit celle de la fonction.
 await page.waitForTimeout(800);const img=await page.evaluate(()=>document.body.innerHTML.includes('image/png;base64'));if(!img||!demandesImage.includes('Pommes de terre bio'))throw Error('No image for a hand-noted product '+JSON.stringify({img,demandesImage}));
 const bords=await garder.evaluate(e=>getComputedStyle(e).borderTopWidth);
 await garder.click();await btn('Annuler : Pommes de terre bio retiré de ta liste').last().click();
 // Le dernier point réglé ferme la feuille ; « Annuler » reste au bilan, et la question revient.
 await page.getByRole('button',{name:/^Manques :.*1 doublon possible.*Préciser$/}).last().click();
 await garder.waitFor();await btn('Ce sont deux achats différents').last().click();
 await page.waitForTimeout(500);if(await page.getByRole('button',{name:/doublon possible/}).count())throw Error('Doublon still asked after keeping both');
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true,bords}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
