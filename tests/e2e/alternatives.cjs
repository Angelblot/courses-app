/* Référence et alternatives (AL3 · MP1) : la grille ne montre que les références, la fiche classe et ajoute. */
const {chromium}=require('playwright');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:false,image_url:null,volume_ml:null,nutriscore:null,category:'pls'};
const products=[
 {...base,id:'emmental',name:'Emmental râpé fondant CARREFOUR',ean13:'3560071178345',brand:"CLASSIC'",grammage_g:200,product_type:'fromage rape',alternatives:['gruyere']},
 {...base,id:'gruyere',name:'Gruyère Râpé',ean13:'3564709168807',brand:'Leclerc',grammage_g:100,product_type:'fromage rape',alternatives:[]},
 {...base,id:'comte',name:'Comté râpé',ean13:'3000000000001',brand:'Président',grammage_g:150,product_type:'fromage rape',alternatives:[]},
];
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ecritures=[];
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=req.url();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/products')&&req.method()==='PATCH'){const id=new URL(url).searchParams.get('id').replace('eq.','');const corps=req.postDataJSON();ecritures.push({id,...corps});Object.assign(products.find(p=>p.id===id),corps);}
  else if(url.includes('/rest/v1/products'))data=url.includes('reprise_statut')?{image_url:null,image_originale:null,image_reprise:null,reprise_statut:null,reprise_le:null}:products;
  await route.fulfill({json:data});});
 await page.addInitScript(({session})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));},{session});
 const btn=(name)=>page.getByRole('button',{name,exact:true});
 await page.goto(`http://localhost:${process.env.PORT||'8082'}/favoris`);
 const emmental=page.getByRole('button',{name:/^Consulter Emmental râpé fondant/});await emmental.waitFor({timeout:60000});
 // MP1 : seules les références ; le gruyère vit sous l'emmental, une pastille le dit.
 if(await page.getByRole('button',{name:/^Consulter Gruyère/}).count())throw Error('An alternative is shown as a product');
 await page.getByRole('button',{name:/^Consulter Emmental râpé fondant CARREFOUR, 200 g, 2 choix/}).waitFor();
 await page.screenshot({path:process.env.CAPTURES?process.env.CAPTURES+'/mp1.png':'/tmp/mp1.png'});
 await emmental.click();await page.getByText('Ordre d’essai',{exact:true}).waitFor();
 await page.getByRole('adjustable',{name:/^Emmental râpé fondant CARREFOUR, rang 1 sur 2, référence/}).waitFor().catch(async()=>{await page.getByLabel(/rang 1 sur 2, référence/).waitFor();});
 await page.waitForTimeout(500);await page.screenshot({path:process.env.CAPTURES?process.env.CAPTURES+'/al3.png':'/tmp/al3.png'});
 // Ajouter : la feuille propose d'abord le même type.
 await page.getByRole('button',{name:/Ajouter un produit à cette liste/}).click();await page.getByText('Même type dans tes produits',{exact:true}).waitFor();
 await page.screenshot({path:process.env.CAPTURES?process.env.CAPTURES+'/ajout-alt.png':'/tmp/ajout-alt.png'});
 await page.getByRole('button',{name:/^Ajouter Comté râpé/}).first().click();
 await page.waitForTimeout(800);
 const derniere=ecritures.at(-1);if(derniere?.id!=='emmental'||JSON.stringify(derniere.alternatives)!==JSON.stringify(['gruyere','comte']))throw Error('Bad add '+JSON.stringify(ecritures));
 // Retirer une alternative.
 {const l=page.getByLabel('Gruyère Râpé',{exact:true});const bx=await l.boundingBox(),x=bx.x+bx.width*0.6,y=bx.y+bx.height/2;await page.mouse.move(x,y);await page.mouse.down();for(let k=1;k<=12;k++){await page.mouse.move(x-300*k/12,y);await page.waitForTimeout(16);}await page.mouse.up();await page.waitForTimeout(900);}
 if(JSON.stringify(ecritures.at(-1).alternatives)!==JSON.stringify(['comte']))throw Error('Bad remove '+JSON.stringify(ecritures));
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true,ecritures}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
