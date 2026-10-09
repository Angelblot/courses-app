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
const offre=(id,recherche,libelle,prix,rang)=>({id,recherche_id:null,recherche,cart_job_id:'cr1',drive:'carrefour',libelle,marque:null,ean13:null,url:null,image_url:null,prix,prix_unitaire:null,unite_prix:null,grammage_g:null,volume_ml:null,nutriscore:null,promotion:null,disponible:true,rang,vu_le:'2026-10-09T12:00:00Z'});
const offres=[offre('o1','Ail blanc 1p','BLVIE Piquets De Tente À Visser (blanc Luminescent, 10 Pièces)',24.29,0),offre('o2','Ail blanc 1p','Ail blanc filet 3 têtes',1.29,1)];
const ecrit={produits:[],jobs:[],recherches:[]};
const dossier=process.env.CAPTURES||'/tmp';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});let page;try{
 page=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://qmymwicsgilhoihtfdjm.supabase.co/**',async route=>{const req=route.request(),url=req.url();let data=[];
  if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/token'))data=session;
  else if(url.includes('/rest/v1/cart_jobs')&&req.method()==='POST'){ecrit.jobs.push(req.postDataJSON());data=null;}
  else if(url.includes('/rest/v1/cart_jobs'))data=url.includes('id=eq.cr2')?pause:url.includes('id=eq.')?job:[job];
  else if(url.includes('/rest/v1/offres_drive'))data=url.includes('cart_job_id=eq.cr1')?offres:[];
  else if(url.includes('/rest/v1/products')&&req.method()==='POST'){ecrit.produits.push(req.postDataJSON());data={id:'nouveau'};}
  else if(url.includes('/rest/v1/recherches_drive')&&req.method()==='POST'){ecrit.recherches.push(req.postDataJSON());data=null;}
  await route.fulfill({json:data});});
 await page.addInitScript(({session})=>{localStorage.setItem('sb-qmymwicsgilhoihtfdjm-auth-token',JSON.stringify(session));},{session});
 const texte=t=>page.getByText(t,{exact:true});
 await page.goto('http://localhost:8082/suivi/cr1');
 await page.getByRole('heading',{name:'Compte rendu'}).waitFor({timeout:60000});
 await texte('2 produits au panier').waitFor();await texte('NON AJOUTÉS · 4').waitFor();
 for(const t of ['Marque E.Leclerc','Introuvable','Plusieurs produits possibles','Ajout refusé par le site'])await texte(t).waitFor();
 await page.getByRole('button',{name:'Cacahuètes grillées à sec maxi format BÉNÉNUTS. Plusieurs produits possibles. Remplacer'}).waitFor();
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/cr1-carrefour.png'});
 await page.getByRole('button',{name:'Voir les 2 ajoutés'}).click();await texte('AU PANIER · 2').waitFor();await texte('× 6').waitFor();
 await page.getByRole('tab',{name:/^E\.Leclerc, 2 sur 3/}).click();
 await texte('Marque Carrefour').waitFor();await texte('NON AJOUTÉS · 1').waitFor();
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/cr2-leclerc.png'});
 // Remplacer : les offres vues qui parlent du produit, sans les piquets de tente.
 await page.getByRole('tab',{name:/^Carrefour/}).click();
 await page.getByRole('button',{name:'Ail blanc 1p. Introuvable. Remplacer'}).click();
 await texte('VUS PAR L’EXTENSION SUR CARREFOUR').waitFor();
 if(await page.getByText(/Piquets De Tente/).count())throw Error('Offre sans rapport proposée');
 await page.getByRole('radio',{name:/^Ail blanc filet 3 têtes, 1,29 €/}).click();
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/cr4-remplacer.png'});
 await page.getByRole('button',{name:'Choisir ce produit · 1,29 €'}).click();
 await page.getByRole('button',{name:/^Ail blanc 1p, remplacé par Ail blanc filet 3 têtes · 1,29 €/}).waitFor();
 // Rien de convaincant vu : chercher plus court.
 await page.getByRole('button',{name:'Gratte-éponges x3 SPONTEX. Ajout refusé par le site. Remplacer'}).click();
 await texte('Rien de convaincant sur la page vue').waitFor();
 await page.getByRole('button',{name:'« gratte éponges »'}).click();
 await page.waitForTimeout(500);if(!ecrit.recherches.length)throw Error('Recherche plus courte non demandée');
 await page.getByRole('button',{name:'Laisser sans produit sur Carrefour'}).click();
 await page.waitForTimeout(300);await page.screenshot({path:dossier+'/cr5-remplace.png'});
 await page.getByRole('button',{name:'Ajouter le remplacement au panier'}).click();
 await page.waitForURL(/suivi\/envoye/,{timeout:15000});
 const envoye=ecrit.jobs[0];if(!envoye||envoye.drives.join()!=='carrefour'||envoye.items.length!==1||envoye.items[0].product_id!=='nouveau')throw Error('Envoi inattendu '+JSON.stringify(envoye));
 // En pause : pas d'invitation à payer un panier incomplet.
 await page.goto('http://localhost:8082/suivi/cr2');await texte('En pause').waitFor({timeout:60000});
 if(await page.getByText(/à payer sur/).count())throw Error('En pause, le bandeau invite à payer');
 await page.waitForTimeout(400);await page.screenshot({path:dossier+'/cr3-pause.png'});
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true}));
 }catch(e){console.error(e);await page?.screenshot({path:dossier+'/cr-erreur.png'}).catch(()=>{});process.exitCode=1}finally{await b.close()}})();
