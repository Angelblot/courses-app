/* Run with NODE_PATH pointing to a Playwright installation and the Vite server running.
   These tests intercept every API call: no drive account or basket is touched. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.COURSES_TEST_URL || 'http://127.0.0.1:5173';
const output = process.env.COURSES_TEST_OUTPUT || '/tmp/courses-ui-review';
const recipes = [
  {id: 1, name: 'Pâtes à la tomate', category: 'Plat', servings_default: 2, ingredients: [{name:'Tomates',product_type:'tomates',quantity_per_serving:100,unit:'g',product_id:1}]},
  {id: 2, name: 'Salade de saison', category:'Entrée', servings_default:2, ingredients:[]},
  {id: 3, name: 'Gratin de légumes', category:'Plat', servings_default:2, ingredients:[]},
];
const products = [
  {id:1,name:'Tomates',product_type:'tomates',brand:'Carrefour',favorite:true,unit:'pièce',default_quantity:1,category:'Légumes',category_key:'legumes',category_label:'Légumes',drive_names:['carrefour']},
  {id:2,name:'Café moulu',brand:'Carte Noire',favorite:true,unit:'paquet',default_quantity:1,category:'Épicerie',category_key:'epicerie',category_label:'Épicerie',drive_names:['carrefour']},
];
(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({headless:true, channel: process.env.COURSES_BROWSER || 'chrome'});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,serviceWorkers:'block'});
    const errors=[];
    page.on('pageerror', e => errors.push(e.message));
    let failure = '', emptyRecipes = false, noDrives = false;
    let lastPayload, generateCalls = 0;
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const send = (body, status=200) => route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
      if (path === '/api/recipes/') return send(emptyRecipes ? [] : recipes);
      if (path === '/api/products/') return send(products);
      if (path === '/api/categories/') return send([{key:'legumes',label:'Légumes'},{key:'epicerie',label:'Épicerie'}]);
      if (path === '/api/lists/') return send([]);
      if (path === '/api/drives/configs') return send(noDrives ? [] : [{name:'carrefour',enabled:true}]);
      if (path === '/api/wizard/sessions') {lastPayload=route.request().postDataJSON();return send(failure === 'create' ? {detail:'unavailable'} : {id:42}, failure === 'create' ? 503 : 200);}
      if (path.endsWith('/generate')) {generateCalls++;return send({job_id:'wizard-42'},failure==='generate' ? 503 : 200);}
      if (path.endsWith('/results')) return send(failure==='results' ? {detail:'unavailable'} : {session_id:42,status:'generating',drives:{carrefour:{items:[],missing:[],total:0}}},failure==='results'?503:200);
      return send([]);
    });
    const click = (name) => page.getByRole('button',{name,exact:true}).click();
    const visible = async (locator) => {await locator.waitFor({state:'visible'}); assert(await locator.isVisible());};
    const noOverflow = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
    await page.goto(base+'/meals');
    const meal = page.locator('.meal__select').filter({hasText:'Pâtes à la tomate'});
    await meal.click();
    await page.getByRole('button',{name:'Ajouter aux favorites : Pâtes à la tomate'}).click();
    await page.getByRole('group',{name:'Personnes pour Pâtes à la tomate'}).getByRole('button',{name:'Augmenter'}).click();
    await page.reload();
    assert.equal(await meal.getAttribute('aria-pressed'),'true');
    assert.equal(await page.getByRole('button',{name:'Retirer des favorites : Pâtes à la tomate'}).getAttribute('aria-pressed'),'true');
    await page.getByRole('link',{name:'Voir ma liste · 1 repas'}).click();
    await visible(page.getByRole('heading',{name:'Ma liste',exact:true}));
    await page.getByRole('group',{name:'Quantité de Tomates'}).getByRole('button',{name:'Augmenter'}).click();
    await page.getByRole('checkbox',{name:'Déjà chez moi : Tomates',exact:true}).click();
    await page.getByRole('tab',{name:'Déjà chez moi'}).click();
    await visible(page.getByText('Tomates',{exact:true}));
    await page.reload();
    await page.getByRole('tab',{name:'Déjà chez moi'}).click();
    await page.getByRole('checkbox',{name:'Déjà chez moi : Tomates',exact:true}).click();
    await page.getByRole('tab',{name:'À acheter',exact:true}).click();
    await page.getByRole('textbox',{name:'Ajouter un produit',exact:true}).fill('Lessive');
    await page.getByRole('button',{name:'Ajouter à ma liste',exact:true}).click();
    await noOverflow();
    await click('Choisir mon drive');
    await visible(page.getByRole('heading',{name:'Ta liste et tes drives'}));
    assert(await page.getByRole('button',{name:'Créer mes paniers',exact:true}).isDisabled());
    await page.getByRole('button',{name:/Carrefour Drive/}).click();
    failure='create';
    await click('Créer mes paniers');
    await visible(page.getByRole('alert'));
    assert.equal(generateCalls,0);
    failure='generate';
    await click('Créer mes paniers');
    await visible(page.getByRole('link',{name:'Vérifier le suivi'}));
    assert.equal(lastPayload.ingredient_overrides[0].product_id,1);
    assert.equal(lastPayload.quotidien.length,0);
    failure='';
    await page.getByRole('link',{name:'Vérifier le suivi'}).click();
    await visible(page.getByRole('heading',{name:'Préparation demandée'}));
    assert.equal(await page.getByText('0,00 €',{exact:true}).count(),0);
    failure='results';await click('Actualiser le suivi');await visible(page.getByRole('alert'));
    failure='';
    await page.goto(base+'/products');
    await page.getByRole('searchbox',{name:'Rechercher un produit',exact:true}).fill('cafe');
    await visible(page.getByText('Café moulu',{exact:true}));
    await page.evaluate(()=>localStorage.clear());
    emptyRecipes=true;noDrives=true;
    await page.goto(base+'/current-list');
    assert(await page.getByRole('button',{name:'Choisir mon drive',exact:true}).isDisabled());
    await page.getByRole('textbox',{name:'Ajouter un produit',exact:true}).fill('Pain');
    await page.getByRole('button',{name:'Ajouter à ma liste',exact:true}).click();
    await click('Choisir mon drive');
    await visible(page.getByRole('link',{name:'Configurer un drive'}));
    assert(await page.getByRole('button',{name:'Créer mes paniers',exact:true}).isDisabled());
    await page.setViewportSize({width:320,height:740});await noOverflow();
    await click('Retour');
    await visible(page.getByRole('heading',{name:'Ma liste',exact:true}));
    assert.deepEqual(errors,[]);
    console.log('PASS: recipe favorites/portions, pantry and quantity persistence, optional recipes, back navigation, product search, unavailable drives, launch errors and truthful results.');
    console.log(`Screenshots: ${output}`);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
