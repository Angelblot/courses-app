import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dernieresParDrive, phase, libelleStatut, offresDuDrive, basculerChoix, planGarde, ficheDepuisOffre, prixLisible } from './recherche-drive.ts';

const rech = (id, drive, statut, demandee_le, resultats = null) => ({ id, drive, requete: 'papier sulfurisé', ean13: null, statut, resultats, demandee_le, faite_le: null });
const offre = (id, drive, rang, extra = {}) => ({ id, recherche_id: 'r', drive, libelle: `Papier ${id}`, marque: null, ean13: null, url: null, image_url: null,
  prix: 2.5, prix_unitaire: null, unite_prix: null, grammage_g: null, volume_ml: null, nutriscore: null, promotion: null, disponible: true, rang, vu_le: '2026-10-05T10:00:00Z', ...extra });

test('recherche drive : la plus récente de chaque drive compte', () => {
  const d = dernieresParDrive([rech('a', 'carrefour', 'vide', '2026-10-01'), rech('b', 'carrefour', 'en_attente', '2026-10-05'), rech('c', 'leclerc', 'faite', '2026-10-05', 4)]);
  assert.equal(d.carrefour.id, 'b');
  assert.equal(d.leclerc.id, 'c');
});

test('recherche drive : les phases du parcours', () => {
  assert.equal(phase([], []), 'aucune');
  assert.equal(phase([rech('a', 'carrefour', 'en_attente', '1')], []), 'attente');
  assert.equal(phase([rech('a', 'carrefour', 'verification', '1')], []), 'attente');
  assert.equal(phase([rech('a', 'carrefour', 'vide', '1'), rech('b', 'leclerc', 'echec', '1')], []), 'sans_resultat');
  assert.equal(phase([rech('a', 'carrefour', 'faite', '1', 2), rech('b', 'leclerc', 'en_attente', '1')], [offre('x', 'carrefour', 0)]), 'resultats');
});

test('recherche drive : la ligne d’état de chaque drive', () => {
  assert.equal(libelleStatut(undefined), 'pas demandée');
  assert.equal(libelleStatut(rech('a', 'carrefour', 'en_attente', '1')), 'pas encore lancée');
  assert.equal(libelleStatut(rech('a', 'carrefour', 'faite', '1', 1)), '1 trouvé');
  assert.equal(libelleStatut(rech('a', 'carrefour', 'faite', '1', 7)), '7 trouvés');
  assert.equal(libelleStatut(rech('a', 'leclerc', 'vide', '1')), 'rien trouvé');
});

test('recherche drive : les offres d’un drive dans son ordre, les indisponibles à la fin', () => {
  const o = offresDuDrive([offre('c2', 'carrefour', 1), offre('l1', 'leclerc', 0), offre('c3', 'carrefour', 0, { disponible: false }), offre('c1', 'carrefour', 2)], 'carrefour');
  assert.deepEqual(o.map(x => x.id), ['c2', 'c1', 'c3']);
});

test('recherche drive : au plus un choix par drive, un 2e remplace, rechoisir retire', () => {
  let c = basculerChoix({}, { id: 'c1', drive: 'carrefour' });
  c = basculerChoix(c, { id: 'l1', drive: 'leclerc' });
  assert.deepEqual(c, { carrefour: 'c1', leclerc: 'l1' });
  c = basculerChoix(c, { id: 'c2', drive: 'carrefour' });
  assert.deepEqual(c, { carrefour: 'c2', leclerc: 'l1' });
  c = basculerChoix(c, { id: 'l1', drive: 'leclerc' });
  assert.deepEqual(c, { carrefour: 'c2' });
});

test('recherche drive : deux choix sont réservés à leur drive, Carrefour en premier ; un seul reste partout', () => {
  const deux = planGarde([offre('l1', 'leclerc', 0), offre('c1', 'carrefour', 0)]);
  assert.deepEqual(deux.map(p => [p.offre.id, p.venduChez]), [['c1', 'carrefour'], ['l1', 'leclerc']]);
  assert.deepEqual(planGarde([offre('l1', 'leclerc', 0)]).map(p => p.venduChez), [null]);
});

test('recherche drive : la fiche d’une offre et ses prix lisibles', () => {
  const f = ficheDepuisOffre(offre('c1', 'carrefour', 0, { libelle: 'Papier cuisson sulfurisé 8 m', ean13: '3560070000000', volume_ml: null, grammage_g: null }));
  assert.equal(f.name, 'Papier cuisson sulfurisé 8 m');
  assert.equal(f.ean13, '3560070000000');
  assert.equal(prixLisible(3.49), '3,49 €');
  assert.equal(prixLisible(12.4, 'kg'), '12,40 €/kg');
  assert.equal(prixLisible(null), null);
});
