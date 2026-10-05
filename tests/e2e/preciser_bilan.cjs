/* Préciser au bilan (PR1) : un point à la fois, la recherche commune avec Open Food Facts, et « Retirer ». */
const {chromium}=require('playwright');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:false,image_url:null,volume_ml:null,nutriscore:null,grammage_g:null,alternatives:[],vendu_chez:null,phrases_siri:[]};
const products=[{...base,id:'lait',name:'Lait demi-écrémé',ean13:'3000000000001',brand:'Lactel',product_type:'lait',category:'pls'}];
const antikal={code:'8700216710923',product_name:'Antikal Original Spray',brands:'Antikal',image_url:null,product_quantity:800,categories_tags:[],nutriscore_grade:null};
const dossier=process.env.CAPTURES||'/tmp';
const etat={quotidien:{},quotidienQty:{},ligneQuantites:{},lignePossedees:{},selectedRecipes:{},choixProduits:{},drives:['carrefour'],
 extras:[{id:'rappel-a',name:'Antikal',quantity:1,unit:'unité',rayon:'autre'},{id:'rappel-s',name:'Sel regenerant lave vaisselle',quantity:1,unit:'unité',rayon:'autre'}],
 manques:{'extra:rappel-a':{name:'Antikal',source:'rappels'},'extra:rappel-s':{name:'Sel regenerant lave vaisselle',source:'rappels'}},importsExternes:['rappel:a','rappel:s']};
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let cree=null;
 await page.route('https://world.openfoodfacts.org/**',route=>route.fulfill({json:{products:route.request().url().toLowerCase().includes('antikal')?[antikal]:[],count:1}}));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=req.url();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/products')&&req.method()==='POST'){const c=req.postDataJSON();cree={...base,...c,id:'antikal-id',product_type:'antikal',category:c.category??'autre'};products.push(cree);data=cree;}
  else if(url.includes('/rest/v1/products'))data=url.includes('ean13=eq.')?null:products;
  else if(url.includes('/functions/v1/'))data={ok:false};
  await route.fulfill({json:data});});
 await page.addInitScript(({session,id,etat})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));if(!localStorage.getItem('seeded')){localStorage.setItem('tablee-maison-v1:'+id,JSON.stringify(etat));localStorage.setItem('seeded','yes');}},{session,id:user.id,etat});
 const btn=(name)=>page.getByRole('button',{name,exact:true});
 await page.goto('http://localhost:8082');await btn('Préparer mes courses').waitFor({timeout:60000});
 await btn('Préparer mes courses').click();await btn('Voir le bilan').click();
 await page.getByRole('button',{name:/^Manques :.*Préciser$/}).last().click();
 await page.getByText('Préciser · 1 sur 2',{exact:true}).waitFor();await page.getByText('« Antikal »',{exact:true}).waitFor();
 const choix=page.getByRole('button',{name:/^Choisir Antikal Original Spray/});await choix.waitFor({timeout:20000});
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/pr1-manque.png'});
 await choix.click();
 await page.getByText('Préciser · 2 sur 2',{exact:true}).waitFor();await page.getByText('« Sel regenerant lave vaisselle »',{exact:true}).waitFor();
 if(!cree||cree.name!=='Antikal Original Spray')throw Error('OFF product not created '+JSON.stringify(cree));
 await btn('Retirer Sel regenerant lave vaisselle de ta liste').click();
 await page.getByText('Sel regenerant lave vaisselle retiré de ta liste').last().waitFor();
 await page.waitForTimeout(500);await page.screenshot({path:dossier+'/pr1-retire.png'});
 if(await page.getByRole('button',{name:/^Manques :.*Préciser$/}).count())throw Error('Still something to precise');
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
