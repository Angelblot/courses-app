/* « Améliorer la photo » (AV1) : bouton, attente, avant et après côte à côte, « Garder la nouvelle ». */
const {chromium}=require('playwright');const fs=require('fs');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
// Deux pixels PNG distincts : la photo Open Food Facts (simulée) et la photo reprise.
const OFF='https://images.openfoodfacts.org/images/products/329/207/000/8858/front_fr.49.400.jpg';
const PIXEL='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const REPRISE='data:image/png;base64,'+PIXEL;
const produit={id:'houmous',name:'Houmous extra au basilic',ean13:'3292070008858',unit:'unité',brand:'BLINI',category:'traiteur',favorite:true,image_url:OFF,grammage_g:175,volume_ml:null,product_type:null,nutriscore:null};
const reprise={image_url:OFF,image_originale:null,image_reprise:null,reprise_statut:null,reprise_le:null};
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let lectures=0,demandes=0,patch=null;
 await page.route(OFF,r=>r.fulfill({contentType:'image/png',body:Buffer.from(PIXEL,'base64')}));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=req.url();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/functions/v1/ameliorer-photo')){demandes++;Object.assign(reprise,{reprise_statut:'en_cours',reprise_le:new Date().toISOString()});return route.fulfill({status:202,json:{ok:true,statut:'en_cours'}});}
  else if(url.includes('/rest/v1/products')&&req.method()==='PATCH'){patch=req.postDataJSON();Object.assign(reprise,patch);Object.assign(produit,{image_url:reprise.image_url});data=[];}
  else if(url.includes('/rest/v1/products')&&url.includes('reprise_statut')){
   // La reprise se termine à la troisième lecture : l'app relit toutes les 4 secondes.
   if(reprise.reprise_statut==='en_cours'&&++lectures>=3)Object.assign(reprise,{reprise_statut:'prete',image_reprise:REPRISE});data={...reprise};}
  else if(url.includes('/rest/v1/products'))data=[produit];
  await route.fulfill({json:data});});
 await page.addInitScript(({session})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));},{session});
 const dir=process.env.CAPTURES||'/tmp/ameliorer-photo';fs.mkdirSync(dir,{recursive:true});const shot=n=>page.screenshot({path:`${dir}/${n}.png`});
 const btn=(name)=>page.getByRole('button',{name,exact:true});
 await page.goto('http://localhost:8082/favoris');await page.getByRole('button',{name:/^Consulter Houmous extra au basilic/}).click({timeout:60000});
 await btn('Améliorer la photo').click();await page.getByText('Photo en cours de reprise',{exact:true}).waitFor();await shot('attente');
 await page.getByText('Garder la nouvelle photo ?',{exact:true}).waitFor({timeout:20000});await page.waitForTimeout(500);await shot('choix');
 if(demandes!==1)throw Error('Function called '+demandes+' times');
 await page.getByRole('button',{name:/^Après : .*Voir en grand$/}).click();await btn('Fermer').last().click();
 await btn('Garder la nouvelle').click();await page.waitForTimeout(600);
 if(!patch||patch.image_url!==REPRISE||patch.image_originale!==OFF||patch.reprise_statut!==null)throw Error('Bad keep payload '+JSON.stringify(patch).slice(0,200));
 await btn('Remettre la photo d’origine').waitFor();await shot('gardee');
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true,lectures,demandes}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
