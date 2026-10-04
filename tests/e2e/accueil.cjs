/* Accueil (AC1) : la saison, la salutation, la dernière commande, les recettes et le budget ; plus de manques. */
const {chromium}=require('playwright');
const PORT=process.env.PORT||'8082';
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test',user_metadata:{prenom:'Angelo'}};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const recipes=[
 {id:'r1',name:'Tartiflette express',servings_default:2,image_url:'https://example.test/t.jpg',prep_minutes:9,cook_minutes:32,recipe_ingredients:[]},
 {id:'r2',name:'Smashed potatoes',servings_default:1,image_url:'https://example.test/s.jpg',prep_minutes:5,cook_minutes:25,recipe_ingredients:[]},
 {id:'r3',name:'Sans photo',servings_default:1,image_url:null,prep_minutes:5,cook_minutes:5,recipe_ingredients:[]},
];
const montants=[['2026-06-09',181.29],['2026-04-07',239.7],['2026-02-16',211.6],['2026-01-18',189.14],['2025-12-08',228.1],['2025-11-16',206.45],['2025-09-25',217.35],['2025-08-20',232.07],['2025-02-10',235.08],['2024-12-12',234.77],['2024-11-14',242.63],['2023-07-23',204]];
const lignes=montants.map(([d,t],i)=>({commande:'C'+i,purchase_date:d,drive:i===0?'leclerc':'carrefour',magasin:null,product_id:null,ean13:null,libelle:'x',quantity_delivered:1,total_ttc:t,unit_price_ttc:t}));
const dossier=process.env.CAPTURES||'/tmp';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];let miseAJour=null;page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://example.test/**',r=>r.fulfill({status:404,body:''}));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const url=decodeURIComponent(route.request().url());let data=[];
  if(url.includes('/auth/v1/user')&&route.request().method()==='PUT'){const corps=route.request().postDataJSON();miseAJour=corps;user.user_metadata={...user.user_metadata,...corps.data};data=user;}
  else if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/recipes'))data=recipes;
  else if(url.includes('/rest/v1/purchase_lines'))data=lignes;
  await route.fulfill({json:data});});
 await page.addInitScript(({session})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));},{session});
 await page.goto(`http://localhost:${PORT}/`);
 await page.getByText('Tes prochaines courses',{exact:true}).waitFor({timeout:60000});
 const auj=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}).toUpperCase();
 await page.getByText(auj,{exact:true}).waitFor();
 await page.getByText(/^(Bonjour|Bonsoir) Angelo\.$/).waitFor();
 await page.getByText('9 juin',{exact:true}).waitFor();await page.getByText('181,29 €',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Voir la recette Tartiflette express, 41 min · 2 pers.'}).waitFor();
 if(await page.getByRole('button',{name:/^Voir la recette Sans photo/}).count())throw Error('Recette sans photo dans le carrousel');
 await page.getByText('209 €',{exact:true}).waitFor();await page.getByText('−8 %',{exact:true}).waitFor();
 if(await page.getByText('Mes manques',{exact:true}).count())throw Error('Les manques sont encore sur l’accueil');
 await page.waitForTimeout(500);await page.screenshot({path:dossier+'/accueil.png'});
 await page.getByRole('button',{name:/^209 euros par commande en moyenne/}).click();
 await page.waitForURL(/commandes/,{timeout:10000});
 // Réglages : le prénom se change, et l'accueil suit.
 await page.goto(`http://localhost:${PORT}/compte`);
 const champ=page.getByLabel('Ton prénom, affiché sur l’accueil');await champ.waitFor({timeout:30000});
 if(await champ.inputValue()!=='Angelo')throw Error('Prénom lu : '+await champ.inputValue());
 await champ.fill('Marie');await champ.press('Enter');await page.waitForTimeout(800);
 if(miseAJour?.data?.prenom!=='Marie')throw Error('Prénom non enregistré : '+JSON.stringify(miseAJour));
 await page.goto(`http://localhost:${PORT}/`);await page.getByText(/^(Bonjour|Bonsoir) Marie\.$/).waitFor({timeout:30000});
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
