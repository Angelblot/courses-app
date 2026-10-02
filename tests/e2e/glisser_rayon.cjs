/* Mes produits : glisser la grille vers la gauche passe au rayon suivant, vers la droite au précédent ; le défilement vertical ne change rien. */
const {chromium}=require('playwright');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:false,image_url:null,volume_ml:null,grammage_g:null,nutriscore:null,alternatives:[],vendu_chez:null,phrases_siri:[],ean13:null,brand:null};
const products=[
 {...base,id:'a',name:'Avocat',category:'fruits_legumes',product_type:'avocat'},
 {...base,id:'b',name:'Oignons jaunes',category:'fruits_legumes',product_type:'oignon'},
 {...base,id:'c',name:'Emmental râpé',category:'pls',product_type:'fromage rape'},
 {...base,id:'d',name:'Feta',category:'pls',product_type:'feta'},
];
const dossier=process.env.CAPTURES||'/tmp';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const url=route.request().url();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;else if(url.includes('/rest/v1/products'))data=products;
  await route.fulfill({json:data});});
 await page.addInitScript(({session})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));},{session});
 await page.goto('http://localhost:8082/favoris');
 await page.getByText('Feta',{exact:true}).waitFor({timeout:60000});
 const actif=async()=>page.locator('[role=tab][aria-selected=true]').getAttribute('aria-label');
 const glisser=async(de,a)=>{await page.mouse.move(de,520);await page.mouse.down();for(let i=1;i<=12;i++)await page.mouse.move(de+(a-de)*i/12,520+i);await page.mouse.up();await page.waitForTimeout(400);};
 if(await actif()!=='Tous, 4')throw Error('Départ : '+await actif());
 await glisser(330,60);
 if(await actif()!=='Fruits & légumes, 2')throw Error('Après un glissé à gauche : '+await actif());
 if(await page.getByText('Feta',{exact:true}).count())throw Error('Feta ne devrait plus être visible');
 await glisser(330,60);
 if(await actif()!=='Produits laitiers, 2')throw Error('Deuxième glissé : '+await actif());
 await glisser(330,60); // dernier rayon : rien ne bouge
 if(await actif()!=='Produits laitiers, 2')throw Error('Au bout : '+await actif());
 await page.screenshot({path:dossier+'/glisser-rayon.png'});
 await glisser(60,330);
 if(await actif()!=='Fruits & légumes, 2')throw Error('Glissé à droite : '+await actif());
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
