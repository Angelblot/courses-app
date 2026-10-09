/** Lancer : node --test mobile/lib/compte-rendu.test.mjs (Node >= 22) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raison, bilanParDrive, adresseReprise, requeteSansMarque } from './compte-rendu.ts';

test('chaque raison de l’extension a son mot et son geste', () => {
  const d = ['carrefour', 'leclerc'];
  assert.deepEqual(raison({ item: 'Crème Bio Village', ok: false, reason: 'product_unavailable', autreEnseigne: true }, 'carrefour', d), { libelle: 'Marque E.Leclerc', ton: 'neutre', action: 'Remplacer' });
  assert.equal(raison({ item: 'x', ok: false, reason: 'product_unavailable' }, 'carrefour', d).libelle, 'En rupture');
  assert.equal(raison({ item: 'x', ok: false, reason: 'no_match' }, 'carrefour', d).libelle, 'Introuvable');
  assert.equal(raison({ item: 'x', ok: false, reason: 'ambiguous' }, 'carrefour', d).action, 'Choisir');
  assert.equal(raison({ item: 'x', ok: false, reason: 'click_no_effect' }, 'leclerc', d).libelle, 'Ajout refusé par le site');
  assert.equal(raison({ item: 'x', ok: false, reason: 'inconnue' }, 'leclerc', d).libelle, 'Non ajouté');
});

test('un bilan par drive, et une adresse pour reprendre', () => {
  const b = bilanParDrive({ carrefour: [{ item: 'A', ok: true }, { item: 'B', ok: false }], leclerc: null });
  assert.deepEqual(b.map(x => [x.drive, x.ajoutes.length, x.manquants.length, x.total]), [['carrefour', 1, 1, 2], ['leclerc', 0, 0, 0]]);
  assert.equal(adresseReprise({ item: 'Ail', ok: false, searchUrl: 'https://www.carrefour.fr/s?q=Ail' }, 'carrefour'), 'https://www.carrefour.fr/s?q=Ail');
  assert.equal(adresseReprise({ item: 'Ail blanc', ok: false, searchUrl: 'javascript:x' }, 'leclerc'), 'https://www.leclercdrive.fr/recherche.aspx?TexteRecherche=Ail%20blanc');
  // Un hôte étranger venu de la base n'est jamais ouvert.
  assert.equal(adresseReprise({ item: 'Ail', ok: false, searchUrl: 'https://evil.example/s?q=Ail' }, 'carrefour'), 'https://www.carrefour.fr/s?q=Ail&noRedirect=1');
  // Leclerc : le magasin vu sur une autre ligne.
  const vue = { item: 'Oignons', ok: true, searchUrl: 'https://fd3-courses.leclercdrive.fr/magasin-093401-093401-Le-Cres/recherche.aspx?TexteRecherche=Oignons' };
  assert.equal(adresseReprise({ item: 'Ail', ok: false }, 'leclerc', [vue]), 'https://fd3-courses.leclercdrive.fr/magasin-093401-093401-Le-Cres/recherche.aspx?TexteRecherche=Ail');
});

test('remplacer cherche sans la marque de l’autre enseigne', () => {
  assert.equal(requeteSansMarque('Boulettes à la thaï CARREFOUR SENSATION'), 'Boulettes à la thaï');
  assert.equal(requeteSansMarque('Crème entière fluide UHT Bio Bio Village 30% MG - 25cl'), 'Crème entière fluide UHT Bio 30% MG - 25cl');
  assert.equal(requeteSansMarque('Ail'), 'Ail');
  assert.equal(adresseReprise({ item: 'Boulettes à la thaï CARREFOUR SENSATION', ok: false, autreEnseigne: true, searchUrl: 'https://www.carrefour.fr/s?q=x' }, 'carrefour'), 'https://www.carrefour.fr/s?q=Boulettes%20%C3%A0%20la%20tha%C3%AF&noRedirect=1');
  assert.equal(raison({ item: 'x', ok: false, reason: 'no_add_button' }, 'carrefour', ['carrefour']).libelle, 'En rupture');
  assert.equal(raison({ item: 'x', ok: false, reason: 'product_unavailable', autreEnseigne: true }, 'carrefour', ['carrefour']).libelle, 'Marque d’une autre enseigne');
});
