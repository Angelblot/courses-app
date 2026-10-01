/* Reprise Rappels (RA1) : les articles arrivent comme un ajout Siri, un message discret propose « Annuler ». */
const {chromium}=require('playwright');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:false,image_url:null,volume_ml:null,nutriscore:null,grammage_g:null,alternatives:[],vendu_chez:null,ean13:null,phrases_siri:[]};
const products=[{...base,id:'lait',name:'Lait demi-écrémé',brand:'Lactel',product_type:'lait',category:'pls'}];
const dossier=process.env.CAPTURES||'/tmp';
// L'état tel que la reprise le laisse : deux articles repris de « Achats Courses », pas encore rattachés.
const etat={quotidien:{},quotidienQty:{},ligneQuantites:{},lignePossedees:{},selectedRecipes:{},choixProduits:{},drives:['carrefour'],
 extras:[{id:'rappel-r1',name:'Crème fraîche',quantity:1,unit:'unité',rayon:'autre'},{id:'rappel-r2',name:'Lait',quantity:2,unit:'unité',rayon:'autre'}],
 manques:{'extra:rappel-r1':{name:'Crème fraîche',source:'rappels',valide:false},'extra:rappel-r2':{name:'Lait',source:'rappels',valide:false}},
 importsExternes:['rappel:r1','rappel:r2'],derniereReprise:{liste:'Achats Courses',ids:['r1','r2'],cles:['extra:rappel-r1','extra:rappel-r2']}};
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const url=route.request().url();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;else if(url.includes('/rest/v1/products'))data=products;
  await route.fulfill({json:data});});
 await page.addInitScript(({session,id,etat})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));if(!localStorage.getItem('seeded')){localStorage.setItem('tablee-maison-v1:'+id,JSON.stringify(etat));localStorage.setItem('seeded','yes');}},{session,id:user.id,etat});
 await page.goto('http://localhost:8082/manques');
 // Sur le web, sans la synchronisation iOS, rien n'est rattaché : les deux lignes attendent qu'on les précise.
 await page.getByRole('button',{name:'Crème fraîche, repris de Rappels, produit pas reconnu. Choisir le produit'}).waitFor({timeout:60000});
 await page.getByRole('button',{name:'Lait, repris de Rappels, produit pas reconnu. Choisir le produit'}).waitFor();
 const message=page.getByText('2 articles repris de « Achats Courses » et cochés dans Rappels');await message.waitFor();
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/ra1.png'});
 await page.getByRole('button',{name:'Annuler : 2 articles repris de « Achats Courses » et cochés dans Rappels'}).click();
 await page.getByText('Rien ne manque pour le moment.').waitFor();
 // Le message ne revient pas à la visite suivante.
 await page.reload();await page.getByText('Rien ne manque pour le moment.').waitFor();await page.waitForTimeout(800);
 if(await page.getByText(/repris de « Achats Courses »/).count())throw Error('Message shown twice');
 await page.goto('http://localhost:8082/siri');await page.getByText('Depuis Rappels',{exact:true}).waitFor();
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/siri-web.png'});
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
