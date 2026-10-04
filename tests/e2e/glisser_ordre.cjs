/* Ordre d'essai : plusieurs glisser-déposer de suite, chacun doit compter (un geste par produit, pas par rang). */
const {chromium}=require('playwright');
const PORT=process.env.PORT||'8082';
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const base={unit:'unité',favorite:false,image_url:null,volume_ml:null,nutriscore:null,category:'charcuterie',product_type:'allumettes',grammage_g:150,brand:null,ean13:null,vendu_chez:null,phrases_siri:[]};
const products=[
 {...base,id:'a',name:'Allumettes Tradilège',alternatives:['b','c']},
 {...base,id:'b',name:'Lardons Herta',alternatives:[]},
 {...base,id:'c',name:'Allumettes Carrefour',alternatives:[]},
];
const dossier=process.env.CAPTURES||'/tmp';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[],ecritures=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=req.url();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/products')&&req.method()==='PATCH'){const id=new URL(url).searchParams.get('id').replace('eq.','');const corps=req.postDataJSON();ecritures.push({id,...corps});Object.assign(products.find(p=>p.id===id),corps);}
  else if(url.includes('/rest/v1/products'))data=url.includes('reprise_statut')?{image_url:null,image_originale:null,image_reprise:null,reprise_statut:null,reprise_le:null}:products;
  await route.fulfill({json:data});});
 await page.addInitScript(({session})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));},{session});
 await page.goto(`http://localhost:${PORT}/favoris`);
 await page.getByRole('button',{name:/^Consulter Allumettes Tradilège/}).click({timeout:60000});
 await page.getByText('Ordre d’essai',{exact:true}).waitFor();
 const rangs=async()=>{const r=[];for(const n of ['Allumettes Tradilège','Lardons Herta','Allumettes Carrefour']){const l=await page.getByLabel(new RegExp(`^${n}, rang \\d`)).getAttribute('aria-label');r[Number(/rang (\d)/.exec(l)[1])-1]=n;}return r.join(' > ');};
 const glisser=async(nom,lignes)=>{
  const poignee=page.getByLabel(new RegExp(`^${nom}, rang \\d`));await poignee.scrollIntoViewIfNeeded();
  const bx=await poignee.boundingBox(),x=bx.x+bx.width/2,y=bx.y+bx.height/2;
  await page.mouse.move(x,y);await page.mouse.down();
  for(let k=1;k<=10;k++){await page.mouse.move(x,y+lignes*68*k/10);await page.waitForTimeout(16);}
  await page.mouse.up();await page.waitForTimeout(700);
 };
 const attendu=[];
 // Trois déplacements de suite, sans recharger la fiche.
 await glisser('Allumettes Carrefour',-1);attendu.push('Allumettes Tradilège > Allumettes Carrefour > Lardons Herta');
 if(await rangs()!==attendu.at(-1))throw Error('1er glisser : '+await rangs());
 await glisser('Lardons Herta',-1);attendu.push('Allumettes Tradilège > Lardons Herta > Allumettes Carrefour');
 if(await rangs()!==attendu.at(-1))throw Error('2e glisser : '+await rangs());
 await glisser('Allumettes Carrefour',-2);attendu.push('Allumettes Carrefour > Allumettes Tradilège > Lardons Herta');
 if(await rangs()!==attendu.at(-1))throw Error('3e glisser : '+await rangs());
 if(ecritures.length<3)throw Error('Écritures : '+JSON.stringify(ecritures));
 await page.screenshot({path:dossier+'/glisser-ordre.png'});
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true,n:ecritures.length}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
