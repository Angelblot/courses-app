/**
 * Vérifie le mapping Open Food Facts, porté d'enrich_ean.py.
 * Ce sont des fonctions pures : aucun appel réseau ici.
 * Lancer : node --test mobile/lib/openfoodfacts.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapOffProduct, contenanceDuLot, estLiquide, echappe, analyserRechercheNom } from './openfoodfacts.ts';

test('un solide reçoit un grammage', () => {
  const fiche = mapOffProduct('3760040427577', {
    product_name: 'Lardons fumés',
    brands: 'Herta',
    product_quantity: 200,
    image_url: 'https://exemple.test/i.jpg',
  });
  assert.equal(fiche.grammageG, 200);
  assert.equal(fiche.volumeMl, null);
  assert.equal(fiche.brand, 'Herta');
  assert.equal(fiche.productType, 'lardon');
});

test('un liquide reçoit un volume', () => {
  const fiche = mapOffProduct('123', {
    product_name: 'Lait demi-écrémé',
    product_quantity: 1000,
  });
  assert.equal(fiche.volumeMl, 1000);
  assert.equal(fiche.grammageG, null);
});

test('la catégorie Open Food Facts sert aussi à détecter un liquide', () => {
  assert.equal(estLiquide('Tropicana', ['en:beverages']), true);
});

test('une quantité absente ne bloque pas la fiche', () => {
  // Le produit reste ajoutable : la contenance se saisit à la main ensuite.
  const fiche = mapOffProduct('123', { product_name: 'Pain de mie' });
  assert.equal(fiche.grammageG, null);
  assert.equal(fiche.volumeMl, null);
  assert.equal(fiche.name, 'Pain de mie');
});

test('une quantité aberrante est ignorée', () => {
  const fiche = mapOffProduct('123', { product_name: 'Riz', product_quantity: -5 });
  assert.equal(fiche.grammageG, null);
});

test('une fiche sans nom est refusée', () => {
  // Sans nom, le produit serait inexploitable dans le catalogue.
  assert.equal(mapOffProduct('123', { product_name: '' }), null);
  assert.equal(mapOffProduct('123', {}), null);
});

test('la marque prend la première quand Open Food Facts en liste plusieurs', () => {
  const fiche = mapOffProduct('123', { product_name: 'Yaourt', brands: 'Danone,Activia' });
  assert.equal(fiche.brand, 'Danone');
});

test('une virgule de tête ne doit pas donner une marque vide', () => {
  // Open Food Facts renvoie parfois une liste avec une entrée vide en tête.
  const fiche = mapOffProduct('123', { product_name: 'Yaourt', brands: ', Danone' });
  assert.equal(fiche.brand, 'Danone');
});

test('une fiche sans nom donne un résultat inconnu, pas une fiche exploitable', () => {
  // mapOffProduct renvoie null : c'est ce que lookupEan doit traduire en
  // `{ etat: 'inconnu' }`, testé ici au niveau du mapping qui porte la règle.
  assert.equal(mapOffProduct('123', { product_name: '   ' }), null);
});

test('un mot-clé de liquide contenant un métacaractère ne casse pas la détection', () => {
  // Aucun des seize mots-clés actuels de MOTS_LIQUIDES n'a de métacaractère,
  // donc estLiquide() seul ne peut pas démontrer la régression corrigée. On
  // teste directement echappe() avec un mot-clé hypothétique contenant une
  // parenthèse : sans échappement, `new RegExp` lèverait une SyntaxError.
  const motCle = 'sauce(maison)';
  assert.doesNotThrow(() => new RegExp(`(^|\\s)${echappe(motCle)}`));
  assert.equal(new RegExp(`(^|\\s)${echappe(motCle)}`).test('la sauce(maison) du chef'), true);
});

test('la fiche porte le rayon déduit et la typologie corrigée', () => {
  const fiche = mapOffProduct('3073781091861', {
    product_name: 'Boursin® Onctueux Ail & Fines Herbes',
    brands: 'BOURSIN',
    product_quantity: 125,
    categories_tags: ['en:dairies', 'en:cheeses', 'en:cheeses-perishable'],
  });
  assert.equal(fiche.categoryKey, 'pls');
  assert.equal(fiche.productType, 'fromage');
  assert.equal(fiche.grammageG, 125);
});

test('un produit sans catégorie reçoit le rayon « autre »', () => {
  const fiche = mapOffProduct('1234567890123', { product_name: 'Chose' });
  assert.equal(fiche.categoryKey, 'autre');
});

test('la note Nutriscore est reprise et normalisée en minuscule', () => {
  const fiche = mapOffProduct('123', {
    product_name: 'Yaourt nature', nutriscore_grade: 'B',
  });
  assert.equal(fiche.nutriscore, 'b');
});

test("un produit non noté garde null, ce n'est pas une erreur", () => {
  // Beaucoup de produits n'ont pas de Nutriscore : sel, café, épices.
  assert.equal(mapOffProduct('123', { product_name: 'Sel fin' }).nutriscore, null);
  assert.equal(
    mapOffProduct('123', { product_name: 'X', nutriscore_grade: 'unknown' }).nutriscore,
    null,
  );
  assert.equal(
    mapOffProduct('123', { product_name: 'X', nutriscore_grade: 'not-applicable' }).nutriscore,
    null,
  );
});

test('une réponse de recherche devient une liste de fiches', () => {
  const fiches = analyserRechercheNom({
    count: 2,
    products: [
      { code: '3154230802280', product_name: 'Lardons fumés', brands: 'Herta',
        product_quantity: 150, categories_tags: ['en:charcuteries'], nutriscore_grade: 'd' },
      { code: '3154230802136', product_name: 'Lardons Fumés 200g', brands: 'Herta' },
    ],
  });
  assert.equal(fiches.length, 2);
  assert.equal(fiches[0].ean13, '3154230802280');
  assert.equal(fiches[0].nutriscore, 'd');
  assert.equal(fiches[0].categoryKey, 'charcuterie');
});

test('les produits sans nom sont écartés, pas rendus vides', () => {
  // mapOffProduct rend null pour une fiche sans libellé : elle serait
  // inutilisable dans une liste de résultats.
  const fiches = analyserRechercheNom({
    products: [{ code: '111', product_name: '' }, { code: '222', product_name: 'Bon' }],
  });
  assert.equal(fiches.length, 1);
  assert.equal(fiches[0].name, 'Bon');
});

test('une réponse vide ou malformée ne casse rien', () => {
  assert.deepEqual(analyserRechercheNom({ products: [] }), []);
  assert.deepEqual(analyserRechercheNom({}), []);
  assert.deepEqual(analyserRechercheNom(null), []);
  assert.deepEqual(analyserRechercheNom('pas du json'), []);
});

test('lookupEan : un 404 d’Open Food Facts est un code-barres inconnu, pas une coupure', async () => {
  const { lookupEan } = await import('./openfoodfacts.ts');
  const reel = globalThis.fetch;
  const repondre = (status, corps) => { globalThis.fetch = async () => new Response(JSON.stringify(corps), { status }); };
  try {
    repondre(404, { code: '3245414146938', status: 0, status_verbose: 'product not found' });
    assert.deepEqual(await lookupEan('3245414146938'), { etat: 'inconnu' });
    repondre(503, {});
    assert.deepEqual(await lookupEan('3245414146938'), { etat: 'hors_ligne' });
    repondre(200, { status: 1, product: { product_name: 'Avocat Haas' } });
    assert.equal((await lookupEan('3000001037576')).etat, 'trouve');
  } finally {
    globalThis.fetch = reel;
  }
});

test('un lot « 2x75g » compte la contenance du lot entier, pas d’un seul élément', () => {
  assert.equal(contenanceDuLot('Allumettes de jambon Tradilège 2x75g', 75), 150);
  assert.equal(contenanceDuLot('Couscous Grain moyen - 5x100g', 100), 500);
  assert.equal(contenanceDuLot('Crème légère 18%mg - 3x20cl', 200), 600);
  assert.equal(contenanceDuLot('Yaourt nature 4 x 125 g', 125), 500);
  // Déjà le total, ou un lot qui ne parle pas de poids : on ne touche à rien.
  assert.equal(contenanceDuLot('Bière DESPERADOS 6 x 33 cl', 1980), 1980);
  assert.equal(contenanceDuLot('Poitrine fumée 2x7T - 200g', 200), 200);
  assert.equal(contenanceDuLot('Lait demi-écrémé 1L', 1000), 1000);
});

test('mapOffProduct applique la contenance du lot', () => {
  const f = mapOffProduct('3661112052256', { product_name: 'Allumettes de jambon Tradilège 2x75g', product_quantity: 75 });
  assert.equal(f.grammageG, 150);
});

test('lookupEan : inconnu d’Open Food Facts, le code est cherché sur Open Beauty Facts et Open Products Facts', async () => {
  const { lookupEan } = await import('./openfoodfacts.ts');
  const reel = globalThis.fetch;
  const absent = () => new Response(JSON.stringify({ status: 0 }), { status: 404 });
  try {
    const appels = [];
    globalThis.fetch = async u => { appels.push(new URL(u).host);
      return u.includes('openbeautyfacts') ? new Response(JSON.stringify({ status: 1, product: { product_name: 'Gel intime', product_quantity: 250 } }), { status: 200 }) : absent(); };
    const r = await lookupEan('3401560000000');
    assert.equal(r.etat, 'trouve');
    assert.equal(r.fiche.name, 'Gel intime');
    assert.equal(r.fiche.origine, 'Open Beauty Facts');
    assert.deepEqual(appels.sort(), ['world.openbeautyfacts.org', 'world.openfoodfacts.org', 'world.openproductsfacts.org']);
    // Une base sœur en panne n'est qu'un recours manqué : inconnu, pas hors ligne.
    globalThis.fetch = async u => u.includes('openbeautyfacts') ? new Response('', { status: 503 }) : absent();
    assert.deepEqual(await lookupEan('3401560000000'), { etat: 'inconnu' });
    // Open Food Facts trouvé : ni recours ni mention d'origine.
    appels.length = 0;
    globalThis.fetch = async u => { appels.push(u); return new Response(JSON.stringify({ status: 1, product: { product_name: 'Avocat' } }), { status: 200 }); };
    const off = await lookupEan('3000001037576');
    assert.equal(off.fiche.origine, undefined);
    assert.equal(appels.length, 1);
  } finally {
    globalThis.fetch = reel;
  }
});
