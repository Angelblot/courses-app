const {chromium}=require('playwright');const fs=require('fs');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const products=[{id:'oeufs',name:'Œufs Plein Air',ean13:'1234567890123',unit:'unité',brand:'Plein air',category:'pls',favorite:true,image_url:null,grammage_g:null,volume_ml:null,product_type:'oeuf'},{id:'patates',name:'Pommes de terre',ean13:'1234567890124',unit:'unité',brand:null,category:'fruits_legumes',favorite:true,image_url:null,grammage_g:1000,volume_ml:null,product_type:'pomme_de_terre'},{id:'oignons',name:'Oignons jaunes',ean13:'1234567890125',unit:'unité',brand:null,category:'fruits_legumes',favorite:true,image_url:null,grammage_g:500,volume_ml:null,product_type:'oignon'}];
const recipes=[{id:'rec1',name:'Poulet rôti aux légumes',servings_default:2,image_url:null,prep_minutes:15,cook_minutes:40,recipe_ingredients:[{id:'ing',name:'Pommes de terre',quantity_per_serving:300,unit:'g',rayon:'fruits_legumes',product_id:'patates'}]}];
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(e.message));let sent;let inserted;
await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=req.url();let data=[];if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;else if(url.includes('/rest/v1/products')){if(req.method()==='POST'){inserted=req.postDataJSON();data={...inserted,id:'off1'};products.push(data);}else if(url.includes('ean13=eq.'))data=null;else data=products;}else if(url.includes('/rest/v1/recipes'))data=recipes;else if(url.includes('/rest/v1/cart_jobs')&&req.method()==='POST'){sent=req.postDataJSON();data={id:'job-demo'};}await route.fulfill({json:data});});
await page.route('https://world.openfoodfacts.org/**',r=>r.fulfill({json:{products:[{code:'3017620422003',product_name:'Crème de noisettes',brands:'Démo',quantity:'400 g',categories_tags:['en:groceries']}]}}));
await page.addInitScript(({session,id})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));if(!localStorage.getItem('seeded')){localStorage.setItem('tablee-maison-v1:'+id,JSON.stringify({quotidien:{oeufs:'needed',patates:'needed'},quotidienQty:{oeufs:1,patates:1}}));localStorage.setItem('seeded','yes');}}, {session,id:user.id});
const btn=name=>page.getByRole('button',{name,exact:true});
await page.goto('http://localhost:8082/ajout');
await page.getByLabel('Produit manquant').fill('Pain du boulanger');
await btn('Augmenter la quantité').click();
await btn('Noter « Pain du boulanger »').click();
await btn('Retirer Pain du boulanger').waitFor();
await page.goto('http://localhost:8082/wizard/recettes');
await btn('+ Choisir').click();
await page.getByRole('button',{name:'Plus de portions pour Poulet rôti aux légumes'}).click({clickCount:3});
await page.screenshot({path:'/tmp/tablee-recettes.png'});
await btn('Vérifier mes manques').click();
// Les œufs du catalogue sont prêts : on ouvre la ligne seulement pour changer la quantité.
await btn('Œufs Plein Air, 1 article, prêt. Modifier').click();
await btn('Augmenter Œufs Plein Air').click();await btn('Enregistrer').click();
// Le pain noté à la main demande un geste avant le drive.
await btn('Garder 2 × Pain du boulanger').click();
await btn('Tout est bon (3)').click();
// Habitudes : on coche les oignons, le reste du rayon est « déjà chez moi ».
await page.getByRole('checkbox',{name:'Oignons jaunes'}).last().click();
await page.screenshot({path:'/tmp/tablee-habitudes.png'});
await btn('Continuer vers les extras · 1 retenu').click();
await page.getByLabel('Produit manquant').last().fill('Noisettes');
await btn('Chercher « Noisettes » sur Open Food Facts').click();
await page.getByText('Crème de noisettes',{exact:true}).click();
await btn('Confirmer l’ajout à ma liste').click();
await btn('Retirer Crème de noisettes').waitFor();
if(inserted.ean13!=='3017620422003'||inserted.favorite!==false)throw Error('OFF identity/favorite mismatch');
await btn('Faire le bilan de ma liste').click();
await page.reload();await btn('Voir et ajuster la liste').last().click();await page.getByText('Pain du boulanger',{exact:true}).last().waitFor();
const draft=await page.evaluate(id=>JSON.parse(localStorage.getItem('tablee-maison-v1:'+id)),user.id);
if(draft.selectedRecipes.rec1!==5||draft.quotidienQty.oeufs!==2||draft.quotidien.oignons!=='needed'||draft.extras[0].quantity!==2||draft.quotidien.off1!=='needed')throw Error('Draft mismatch '+JSON.stringify(draft));
if(errors.length)throw Error(errors.join('\n'));
await page.screenshot({path:'/tmp/tablee-parcours-liste.png'});
console.log(JSON.stringify({success:true,draft,inserted,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));


}catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
