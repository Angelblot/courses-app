/* Mes manques : glisser une ligne vers la gauche découvre « Retirer » ; le retrait s'annule. */
const {chromium}=require('playwright');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:false,image_url:null,volume_ml:null,nutriscore:null,grammage_g:null,alternatives:[],vendu_chez:null,phrases_siri:[],ean13:null};
const products=[{...base,id:'lait',name:'Lait demi-écrémé',brand:'Lactel',product_type:'lait',category:'pls'},{...base,id:'pates',name:'Spaghetti n°5',brand:'Barilla',product_type:'pate',category:'epicerie'}];
const etat={quotidien:{lait:'needed',pates:'needed'},quotidienQty:{lait:2,pates:1},ligneQuantites:{},lignePossedees:{},selectedRecipes:{},choixProduits:{},drives:['carrefour'],extras:[],
 manques:{'produit:lait':{name:'Lait demi-écrémé',source:'widget'},'produit:pates':{name:'Spaghetti n°5',source:'siri'}}};
const dossier=process.env.CAPTURES||'/tmp';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const url=route.request().url();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;else if(url.includes('/rest/v1/products'))data=products;
  await route.fulfill({json:data});});
 await page.addInitScript(({session,id,etat})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));if(!localStorage.getItem('seeded')){localStorage.setItem('tablee-maison-v1:'+id,JSON.stringify(etat));localStorage.setItem('seeded','yes');}},{session,id:user.id,etat});
 await page.goto('http://localhost:8082/manques');
 const ligne=page.getByRole('button',{name:/^Spaghetti n°5, 1 article/});await ligne.waitFor({timeout:60000});
 const r=await ligne.boundingBox();
 await page.mouse.move(r.x+r.width-30,r.y+r.height/2);await page.mouse.down();
 for(let i=1;i<=12;i++){await page.mouse.move(r.x+r.width-30-i*14,r.y+r.height/2);await page.waitForTimeout(16);}
 await page.mouse.up();
 const retirer=page.getByRole('button',{name:'Retirer Spaghetti n°5',exact:true});await retirer.waitFor({timeout:5000});
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/glisser.png'});
 await retirer.click();
 await page.getByText('Spaghetti n°5 retiré de tes manques').last().waitFor();
 if(await page.getByRole('button',{name:/^Spaghetti n°5, 1 article/}).count())throw Error('Row still there');
 await page.getByRole('button',{name:'Annuler : Spaghetti n°5 retiré de tes manques'}).last().click();
 await page.getByRole('button',{name:/^Spaghetti n°5, 1 article/}).waitFor();
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
