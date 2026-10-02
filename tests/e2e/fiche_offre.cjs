/* Appui long sur un résultat Open Food Facts : la fiche détaillée, son comparatif avec des produits proches, et « Choisir ». */
const {chromium}=require('playwright');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:false,image_url:null,volume_ml:null,nutriscore:null,grammage_g:null,alternatives:[],vendu_chez:null,phrases_siri:[]};
const products=[{...base,id:'lait',name:'Lait demi-écrémé',ean13:'3000000000001',brand:'Lactel',product_type:'lait',category:'pls'}];
const n=(k,g,sat,su,se)=>({'energy-kcal_100g':k,fat_100g:g,'saturated-fat_100g':sat,sugars_100g:su,salt_100g:se,fiber_100g:2.7,proteins_100g:5.2});
const lv={fat:'high','saturated-fat':'high',sugars:'high',salt:'moderate'};
const pepitos=[
 {code:'3048282900646',product_name:'Pepito pépite choco',brands:'LU',image_url:null,product_quantity:150,categories_tags:[],nutriscore_grade:'e',nutriments:n(440,23,11,30,0.84),nutrient_levels:lv,nova_group:4,ecoscore_grade:'e',allergens_tags:['en:eggs','en:gluten','en:milk','en:soybeans'],ingredients_text_fr:'Farine de BLÉ 23 %, pépites de chocolat 18 %',serving_size:'30g'},
 {code:'7622210400574',product_name:'Croc sablé goût choco',brands:'LU',image_url:null,product_quantity:294,categories_tags:[],nutriscore_grade:'e',nutriments:n(499,23,11,29,0.66),nutrient_levels:lv,nova_group:4,ecoscore_grade:'c',allergens_tags:['en:gluten','en:milk','en:soybeans']},
 {code:'3017760329798',product_name:'Pockitos chocolat au lait',brands:'LU',image_url:null,product_quantity:295,categories_tags:[],nutriscore_grade:'e',nutriments:n(522,29,16,37,0.3),nutrient_levels:lv,nova_group:4,ecoscore_grade:'d',allergens_tags:['en:eggs','en:gluten','en:milk','en:soybeans']},
];
const dossier=process.env.CAPTURES||'/tmp';
const etat={quotidien:{},quotidienQty:{},ligneQuantites:{},lignePossedees:{},selectedRecipes:{},choixProduits:{},drives:['carrefour'],
 extras:[{id:'rappel-p',name:'Pepito',quantity:1,unit:'unité',rayon:'autre'}],
 manques:{'extra:rappel-p':{name:'Pepito',source:'rappels'}},importsExternes:['rappel:p']};
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let cree=null;
 await page.route('https://world.openfoodfacts.org/**',route=>route.fulfill({json:{products:route.request().url().toLowerCase().includes('pepito')?pepitos:[],count:3}}));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=req.url();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/products')&&req.method()==='POST'){const c=req.postDataJSON();cree={...base,...c,id:'croc-id',product_type:'biscuit',category:c.category??'autre'};products.push(cree);data=cree;}
  else if(url.includes('/rest/v1/products'))data=url.includes('ean13=eq.')?null:products;
  else if(url.includes('/functions/v1/'))data={ok:false};
  await route.fulfill({json:data});});
 await page.addInitScript(({session,id,etat})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));if(!localStorage.getItem('seeded')){localStorage.setItem('tablee-maison-v1:'+id,JSON.stringify(etat));localStorage.setItem('seeded','yes');}},{session,id:user.id,etat});
 const btn=(name)=>page.getByRole('button',{name,exact:true});
 await page.goto('http://localhost:8082');await page.getByText('Les courses, à ton rythme.',{exact:true}).waitFor({timeout:60000});
 await btn('Préparer mes courses').click();await btn('Voir le bilan').click();
 await page.getByRole('button',{name:/^Manques :.*Préciser$/}).last().click();
 await page.getByText('« Pepito »',{exact:true}).waitFor();
 const ligne=page.getByRole('button',{name:/^Choisir Pepito pépite choco/});await ligne.waitFor({timeout:20000});
 // Appui long : sur le web, la fiche complète s'ouvre directement.
 const r=await ligne.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.waitForTimeout(900);await page.mouse.up();
 await page.getByText('Comparé à des produits proches',{exact:true}).waitFor();
 await page.getByText('NOVA 4',{exact:true}).first().waitFor();
 await page.getByText('Pour 100 g · le meilleur de chaque ligne en vert',{exact:true}).waitFor();
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/fiche.png',fullPage:false});
 await page.getByText('Comparé à des produits proches',{exact:true}).scrollIntoViewIfNeeded();await page.waitForTimeout(300);await page.screenshot({path:dossier+'/comparatif.png'});
 await page.getByRole('button',{name:'Choisir Croc sablé goût choco',exact:true}).last().click();
 await page.getByText('Comparé à des produits proches').waitFor({state:'detached'});
 for(let i=0;i<30&&!cree;i++)await page.waitForTimeout(100);
 if(!cree||cree.name!=='Croc sablé goût choco')throw Error('Not created '+JSON.stringify(cree));
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
