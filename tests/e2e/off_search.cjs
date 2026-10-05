const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const PORT=process.env.PORT||'8082';
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',r=>r.fulfill({json:r.request().url().includes('/auth/v1/user')?user:[]}));
  await page.addInitScript(s=>localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(s)),session);
  const appels={};let staleRequested,releaseStale;const staleStarted=new Promise(r=>staleRequested=r),staleReleased=new Promise(r=>releaseStale=r);
  await page.route('https://world.openfoodfacts.org/**',async route=>{
   const q=new URL(route.request().url()).searchParams.get('search_terms');appels[q]=(appels[q]||0)+1;
   if(q==='ancien'){staleRequested();await staleReleased;}
   if(q==='biscuits'&&appels[q]===1)return route.fulfill({status:503,body:'maintenance'});
   return route.fulfill({json:{products:[{code:'1234567890123',product_name:`Produit ${q}`,brands:'Test'}]}}).catch(()=>{});
  });
  await page.goto(`http://localhost:${PORT}/ajout`);const input=page.getByRole('textbox',{name:'Produit manquant'});
  // Entrée note le manque tel quel : la recherche part du bouton dédié.
  const chercher=q=>page.getByRole('button',{name:`Chercher « ${q} » sur Open Food Facts`,exact:true}).click();
  await input.fill('biscuits');await chercher('biscuits');
  await page.getByText('Produit biscuits',{exact:true}).waitFor();assert.equal(appels.biscuits,2);assert.equal(await input.evaluate(e=>document.activeElement===e),false);
  await input.fill('ancien');await chercher('ancien');await staleStarted;
  await input.fill('biscuits');releaseStale();await chercher('biscuits');await page.getByText('Produit biscuits',{exact:true}).waitFor();
  assert.equal(appels.biscuits,2);assert.equal(await page.getByText('Produit ancien',{exact:true}).count(),0);
  await page.goto(`http://localhost:${PORT}/nouvelle-recette`);await page.getByRole('button',{name:'Ajouter un ingrédient',exact:true}).click();
  const ingredient=page.getByPlaceholder('Lardons, crème, spaghetti…');// La recherche d'ingrédient part seule, après une courte pause de frappe.
  await ingredient.fill('creme');await page.getByText('Produit creme',{exact:true}).waitFor();
  await ingredient.fill('tomates');assert.equal(await page.getByText('Produit creme',{exact:true}).count(),0);
  await page.getByText('Produit tomates',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log('PASS: automatic 503 retry, keyboard blur, cached results, stale response suppression, ingredient search reset');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
