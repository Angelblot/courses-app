/**
 * Vérifie le mapping Open Food Facts, porté d'enrich_ean.py.
 * Ce sont des fonctions pures : aucun appel réseau ici.
 * Lancer : node --test mobile/lib/openfoodfacts.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapOffProduct, estLiquide, echappe, analyserRechercheNom } from './openfoodfacts.ts';

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
