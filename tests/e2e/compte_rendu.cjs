/* Compte rendu (variante B) : un onglet par drive, les non-ajoutés avec leur raison et leur geste, les ajoutés à la demande. */
const {chromium}=require('playwright');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@example.test'};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+36000,role:'authenticated'})).toString('base64url'),'demo'].join('.');
const session={access_token:token,refresh_token:'demo',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,token_type:'bearer',user};
const ok=(item,label,quantity=1)=>({item,ok:true,label,quantity});
const ko=(item,reason,x={})=>({item,ok:false,reason,searchUrl:`https://www.carrefour.fr/s?q=${encodeURIComponent(item)}`,...x});
const job={id:'cr1',status:'done',created_at:'2026-10-09T11:52:00Z',progress:{},error:null,results:{
 carrefour:[ok('Oignons jaunes vrac','CARREFOUR\n\nOignons jaunes'),ok('Bière Brewdog Punk IPA 33cl','BREWDOG\n\nBière Blonde IPA Punk',6),
  ko('Crème entière fluide UHT Bio Bio Village 30% MG - 25cl','product_unavailable',{autreEnseigne:true}),ko('Ail blanc 1p','no_match'),
  ko('Cacahuètes grillées à sec maxi format BÉNÉNUTS','ambiguous'),ko('Gratte-éponges x3 SPONTEX','click_no_effect')],
 leclerc:[ok('Oignons jaunes vrac','Oignons jaunes filet'),ok('Crème entière fluide UHT Bio Bio Village 30% MG - 25cl','Crème Bio Village'),ko('Boulettes à la thaï CARREFOUR SENSATION','product_unavailable',{autreEnseigne:true})]}};
const pause={...job,id:'cr2',status:'needs_action',error:'Vérification demandée sur Carrefour.',results:{carrefour:job.results.carrefour.slice(0,3)}};
const dossier=process.env.CAPTURES||'/tmp';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});let page;try{
 page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const url=route.request().url();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/cart_jobs'))data=url.includes('id=eq.cr2')?pause:url.includes('id=eq.')?job:[job];
  await route.fulfill({json:data});});
 await page.addInitScript(({session})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));},{session});
 const texte=t=>page.getByText(t,{exact:true});
 await page.goto('http://localhost:8082/suivi/cr1');
 await page.getByRole('heading',{name:'Compte rendu'}).waitFor({timeout:60000});
 await texte('2 produits au panier').waitFor();await texte('NON AJOUTÉS · 4').waitFor();
 for(const t of ['Marque E.Leclerc','Introuvable','Plusieurs produits possibles','Ajout refusé par le site'])await texte(t).waitFor();
 await page.getByRole('link',{name:'Choisir Cacahuètes grillées à sec maxi format BÉNÉNUTS sur carrefour.fr'}).waitFor();
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/cr1-carrefour.png'});
 await page.getByRole('button',{name:'Voir les 2 ajoutés'}).click();await texte('AU PANIER · 2').waitFor();await texte('× 6').waitFor();
 await page.getByRole('tab',{name:/^E\.Leclerc, 2 sur 3/}).click();
 await texte('Marque Carrefour').waitFor();await texte('NON AJOUTÉS · 1').waitFor();
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/cr2-leclerc.png'});
 // En pause : pas d'invitation à payer un panier incomplet.
 await page.goto('http://localhost:8082/suivi/cr2');await texte('En pause').waitFor({timeout:60000});
 if(await page.getByText(/à payer sur/).count())throw Error('En pause, le bandeau invite à payer');
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/cr3-pause.png'});
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);await page?.screenshot({path:dossier+'/cr-erreur.png'}).catch(()=>{});process.exitCode=1}finally{await b.close()}})();
