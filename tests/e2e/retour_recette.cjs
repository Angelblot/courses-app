/* Une recette ouverte depuis l'accueil ramène à l'accueil, et l'onglet Recettes retrouve sa liste ; depuis la liste, le retour ramène à la liste. */
const {chromium}=require('playwright');
const PORT=process.env.PORT||'8082';
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const recipes=[
 {id:'r1',name:'Tartiflette express',servings_default:2,image_url:'https://example.test/t.jpg',prep_minutes:9,cook_minutes:32,recipe_ingredients:[]},
 {id:'r2',name:'Smashed potatoes',servings_default:1,image_url:'https://example.test/s.jpg',prep_minutes:5,cook_minutes:25,recipe_ingredients:[]},
];
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://example.test/**',r=>r.fulfill({status:404,body:''}));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const url=decodeURIComponent(route.request().url());let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/recipes'))data=url.includes('id=eq.')?recipes.filter(r=>url.includes('id=eq.'+r.id)).map(r=>({...r})):recipes;
  await route.fulfill({json:data});});
 await page.addInitScript(({session})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));},{session});
 const accueil=()=>page.getByText('Tes prochaines courses',{exact:true});
 await page.goto(`http://localhost:${PORT}/`);await accueil().waitFor({timeout:60000});
 // Depuis l'accueil : le retour y ramène.
 await page.getByRole('button',{name:/^Voir la recette Tartiflette express/}).click();
 const retourAccueil=page.getByRole('button',{name:'Revenir à l’accueil',exact:true});await retourAccueil.waitFor({timeout:20000});
 await retourAccueil.click();await accueil().waitFor({timeout:10000});
 if(!await accueil().isVisible())throw Error('Pas revenu à l’accueil');
 // L'onglet Recettes montre la liste, pas la recette restée ouverte.
 await page.getByRole('tab',{name:/Recettes/}).click();
 await page.getByRole('button',{name:'Voir la recette Smashed potatoes',exact:true}).waitFor({timeout:10000});
 if(await page.getByRole('button',{name:'Revenir à l’accueil',exact:true}).isVisible().catch(()=>false))throw Error('La recette est restée ouverte dans l’onglet');
 // Depuis la liste : le retour ramène à la liste.
 await page.getByRole('button',{name:'Voir la recette Tartiflette express',exact:true}).click();
 const retourListe=page.getByRole('button',{name:'Revenir aux recettes',exact:true});await retourListe.waitFor({timeout:10000});await retourListe.click();
 await page.getByRole('button',{name:'Voir la recette Smashed potatoes',exact:true}).waitFor({timeout:10000});
 // Accueil → recette, puis onglet Courses, puis onglet Recettes : on peut toujours en sortir.
 await page.getByRole('tab',{name:/Courses/}).click();await accueil().waitFor();
 await page.getByRole('button',{name:/^Voir la recette Smashed potatoes/}).click();await page.getByRole('button',{name:'Revenir à l’accueil',exact:true}).waitFor();
 await page.getByRole('tab',{name:/Recettes/}).click();await page.waitForTimeout(500);
 const sortie=page.getByRole('button',{name:'Revenir à l’accueil',exact:true});
 if(await sortie.isVisible().catch(()=>false)){await sortie.click();await accueil().waitFor();await page.getByRole('tab',{name:/Recettes/}).click();}
 await page.getByRole('button',{name:'Voir la recette Tartiflette express',exact:true}).waitFor({timeout:10000});
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);process.exitCode=1}finally{await b.close()}})();
