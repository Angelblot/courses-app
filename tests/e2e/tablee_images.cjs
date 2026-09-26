/* Vite must be running. API fixtures come from the repository's seed catalog. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const manifest = require('../../frontend/src/lib/tablee-images.json');
const products = require('../../backend/seed_data.json').products;
const recipes = JSON.parse(execFileSync('python3', ['-c', `import ast,json
from pathlib import Path
m=ast.parse(Path('backend/app/services/recipes_seed.py').read_text())
r=next(ast.literal_eval(n.value) for n in m.body if isinstance(n,ast.AnnAssign) and getattr(n.target,'id','')=='DEFAULT_RECIPES')
for i,item in enumerate(r,1): item['id']=i
print(json.dumps(r))`], {encoding:'utf8'}));
recipes.forEach((r) => {r.image_url=null;});
recipes.forEach((r) => r.ingredients.forEach((ing) => { const p = products.find((p) => ing.product_match && p.name.toLowerCase().includes(ing.product_match.toLowerCase())); if (p) ing.product_id = p.id; }));
const output = process.env.COURSES_TEST_OUTPUT || '/tmp/tablee-image-review';
const base = process.env.COURSES_TEST_URL || 'http://127.0.0.1:5173';
(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.route('**/api/**', route => {
      const path=new URL(route.request().url()).pathname;
      return route.fulfill({contentType:'application/json',body:JSON.stringify(path==='/api/recipes/'?recipes:path==='/api/products/'?products:path==='/api/drives/configs'?[{name:'carrefour',enabled:true}]:[])});
    });
    await page.goto(base+'/meals');
    await page.locator('.meal').first().waitFor();
    await page.locator('.meal').last().scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>[...document.querySelectorAll('.meal img')].length===5 && [...document.querySelectorAll('.meal img')].every(i=>i.complete&&i.naturalWidth>0));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:`${output}/home-mobile.png`,fullPage:true,animations:'disabled'});
    await page.setViewportSize({width:1280,height:900});
    await page.screenshot({path:`${output}/home-desktop.png`,fullPage:true,animations:'disabled'});
    const results = await page.evaluate(async ({recipes,products})=>{
      const {recipeImage,productImageFallback}=await import('/src/lib/tableeImages.js');
      return {
        stock:recipeImage(recipes[0]),
        custom:recipeImage({...recipes[0],image_url:'https://example.com/my-photo.jpg'}),
        unknown:recipeImage({name:'Une nouvelle recette'}),
        product:productImageFallback(products.find(p=>p.name==='Pommes de terre de conservation vrac')),
      };
    },{recipes,products});
    assert.equal(results.stock,manifest.recipes[0].src);
    assert.equal(results.custom,'https://example.com/my-photo.jpg');
    assert.equal(results.unknown,undefined);
    assert.match(results.product,/pommes-de-terre.webp$/);
    for (const asset of [...manifest.recipes,...manifest.products]) {
      const response=await page.request.get(base+asset.src);
      assert(response.ok(),asset.src);
      assert.match(response.headers()['content-type'],/image\/webp/);
    }
    await page.goto(base+'/products');
    await page.getByRole('searchbox').fill('Pommes de terre');
    const potato=page.getByRole('img',{name:/Pommes de terre.*illustration générée/});
    await potato.waitFor();
    await page.waitForFunction(()=>[...document.images].some(i=>i.src.endsWith('pommes-de-terre.webp')&&i.naturalWidth>0));
    await page.screenshot({path:`${output}/products.png`,fullPage:true,animations:'disabled'});
    // Contact sheet of every generated asset, rendered without altering originals.
    await page.setViewportSize({width:1200,height:1000});
    await page.setContent(`<html lang="fr"><meta charset="utf-8"><style>body{font:16px system-ui;background:#faf9f6;color:#272824;padding:30px}h1{font-size:36px}section{display:grid;grid-template-columns:repeat(5,1fr);gap:18px;margin-bottom:30px}img{width:100%;border-radius:10px;object-fit:cover}p{font-size:12px}h2{font-size:22px}</style><h1>Tablée · les visuels</h1><h2>Les recettes</h2><section>${manifest.recipes.map(a=>`<article><img src="${base+a.src}"><p>${a.name}</p></article>`).join('')}</section><h2>Les produits · illustrations génériques</h2><section>${manifest.products.map(a=>`<article><img src="${base+a.src}"><p>${a.name}</p></article>`).join('')}</section></html>`);
    await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
    await page.screenshot({path:`${output}/assets.png`,fullPage:true,animations:'disabled'});
    assert.deepEqual(errors,[]);
    console.log('PASS: recipe imagery, custom photo precedence, product fallback, 20 mappings, mobile/desktop layout.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
