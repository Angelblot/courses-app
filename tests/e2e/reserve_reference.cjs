/* Reference-layout and photo-preservation regression. All API writes are intercepted. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const seed=require('../../backend/seed_data.json');
const base='http://127.0.0.1:5173';
const output='/tmp/reserve-review';
const names=['Lait Demi','Café Capsules','Œufs Plein','Pâtes spaghetti','Pommes de terre','Avocat'];
const selected=[];
for(const name of names){const p=seed.products.find(p=>p.name.toLowerCase().startsWith(name.toLowerCase()));if(p&&!selected.some(x=>x.id===p.id))selected.push({...p,favorite:true});}
const products=[...selected,...seed.products.filter(p=>!selected.some(x=>x.id===p.id)).map(p=>({...p,favorite:false}))];
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  let payload;
  await page.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;let body=[];
   if(path==='/api/products/')body=products;
   if(path==='/api/drives/configs')body=[{name:'carrefour',enabled:true}];
   if(path==='/api/wizard/sessions'){payload=route.request().postDataJSON();body={id:42};}
   if(path.endsWith('/generate'))body={job_id:'wizard-42'};
   if(path.endsWith('/results'))body={session_id:42,status:'generating',drives:{}};
   return route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(base);
  await page.getByRole('heading',{name:'On prépare les courses ?'}).waitFor();
  await page.locator('.reserve-habit').first().waitFor();
  for(const row of await page.locator('.reserve-habit').all())await row.getByRole('button').click();
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>{const i=document.querySelector('.reserve-hero-photo');return i.complete&&i.naturalWidth>0;});
  await page.waitForFunction(()=>[...document.querySelectorAll('.reserve-habit .async-img')].every(i=>i.querySelector('.async-img__img--loaded') || i.classList.contains('async-img--error')));
  await page.screenshot({path:`${output}/home-mobile.png`,animations:'disabled',fullPage:false});
  await page.getByRole('link',{name:'Reprendre ma liste'}).click();
  await page.getByRole('heading',{name:'Ma liste',exact:true}).waitFor();
  assert.equal(await page.locator('.reserve-list-row').count(),3);
  const first=page.locator('.reserve-list-row').first();
  const label=await first.locator('strong').textContent();
  const old=Number(await first.locator('.counter__value').textContent());
  await first.getByRole('button',{name:'Augmenter'}).click();
  assert.equal(Number(await first.locator('.counter__value').textContent()),old+1);
  await first.getByRole('checkbox').click();
  assert.equal(await page.locator('.reserve-list-row').count(),2);
  await page.getByRole('tab',{name:'Déjà chez moi'}).click();
  assert.equal(await page.locator('.reserve-list-row').count(),1);
  await page.reload();
  await page.getByRole('tab',{name:'Déjà chez moi'}).click();
  assert.equal(await page.locator('.reserve-list-row strong').textContent(),label);
  await page.locator('.reserve-list-row').getByRole('checkbox').click();
  await page.getByRole('tab',{name:'À acheter',exact:true}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.reserve-list-row .async-img')].every(i=>i.querySelector('.async-img__img--loaded') || i.classList.contains('async-img--error')));
  await page.screenshot({path:`${output}/list-mobile.png`,animations:'disabled',fullPage:false});
  for(const width of [320,1280]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.screenshot({path:`${output}/list-desktop.png`,animations:'disabled',fullPage:false});
  await page.goto(base);
  await page.screenshot({path:`${output}/home-desktop.png`,animations:'disabled',fullPage:false});
  // Existing recipe photos, including seeded stock URLs, must never be replaced.
  const images=await page.evaluate(async()=>{const {recipeImage,productImageFallback}=await import('/src/lib/tableeImages.js');return{
    existing:recipeImage({name:'Poulet rôti aux légumes',image_url:'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format'}),
    missing:recipeImage({name:'Poulet rôti aux légumes'}),eggs:productImageFallback({name:'Œufs Plein Air'})};});
  assert.match(images.existing,/^https:\/\/images.unsplash.com/);
  assert.match(images.missing,/\/media\/tablee\/recipes\/poulet-roti.webp$/);
  assert.match(images.eggs,/\/products\/oeufs.webp$/);
  await page.getByRole('link',{name:'Reprendre ma liste'}).click();
  await page.getByRole('checkbox').first().click();
  await page.getByRole('button',{name:'Choisir mon drive'}).click();
  await page.getByRole('button',{name:/Carrefour Drive/}).click();
  await page.getByRole('button',{name:'Créer mes paniers',exact:true}).click();
  await page.getByRole('heading',{name:'Préparation demandée'}).waitFor();
  assert.equal(payload.quotidien.filter(p=>p.needed).length,2);
  assert.deepEqual(errors,[]);
  console.log('PASS: reference home/list, tabs, quantities, persistence, original photos preserved, missing-photo fallback, 320/390/1280 layouts, actual purchase payload.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
