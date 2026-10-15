/**
 * Sur une fiche produit du drive : lesquels de tes produits elle peut
 * remplacer. Logique pure, testée dans fiche.test.mjs.
 */

const VIDES = new Set('de du des la le les et au aux en avec pour sans par sur un une x lot pack format saveur gout goût'.split(' '));
const sansAccents = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Les mots qui portent le sens : sans accents, sans chiffres ni mots vides. */
export function motsUtiles(texte) {
  return sansAccents(texte).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/)
    .map((m) => m.replace(/^l'|^d'/, '').replace(/(s|x)$/, ''))
    .filter((m) => m.length >= 3 && !/\d/.test(m) && !VIDES.has(m));
}

/** Tes produits les plus proches de la fiche, du plus au moins proche ; aucun sans mot commun. */
export function produitsProches(titre, produits, max = 4) {
  const cible = new Set(motsUtiles(titre));
  return (produits ?? [])
    .map((p) => {
      const mots = new Set(motsUtiles(`${p.name} ${p.brand ?? ''}`));
      let commun = 0;
      for (const m of mots) if (cible.has(m)) commun += 1;
      return { p, score: commun / Math.max(1, Math.min(cible.size, mots.size)) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name, 'fr'))
    .slice(0, max)
    .map((x) => x.p);
}

/** Tes produits dont le nom contient ce qui est tapé (sans accents ni casse). */
export function chercherProduits(texte, produits, max = 6) {
  const q = sansAccents(texte).toLowerCase().trim();
  if (q.length < 2) return [];
  return (produits ?? []).filter((p) => sansAccents(`${p.name} ${p.brand ?? ''}`).toLowerCase().includes(q)).slice(0, max);
}
