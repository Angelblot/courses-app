/**
 * Ce que le comparatif permet de dire, en quelques phrases : le moins cher à
 * mesure égale (et de combien), le piège du prix bas pour une petite
 * quantité, le meilleur Nutri-Score, le moins transformé, une promotion.
 * Rien ici ne parle à Supabase.
 */
import { libellePrixUnitaire, prixUnitaireLisible, type Unite } from './caracteristiques.ts';

export type ColonneAnalyse = {
  nom: string; prix: number | null; prixUnite: number | null;
  nutriscore: string | null; nova: number | null; promotion: string | null; disponible: boolean;
};

const euros = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
/** Un nom court pour une phrase : sans la marque répétée en fin de libellé. */
export function nomCourt(nom: string): string {
  const mots = nom.replace(/\s+/g, ' ').trim().split(' ');
  if (mots.length > 2 && mots[0].toLowerCase() === mots[mots.length - 1].toLowerCase()) mots.pop();
  const t = mots.join(' ');
  return t.length > 42 ? `${t.slice(0, 40).trimEnd()}…` : t;
}

/** Les indices des plus petites valeurs connues ; vide si moins de deux valeurs ou toutes égales. */
export function plusPetits(valeurs: (number | null)[]): number[] {
  const connues = valeurs.flatMap((v, i) => (v != null ? [{ v, i }] : []));
  if (connues.length < 2) return [];
  const min = Math.min(...connues.map(x => x.v));
  if (connues.every(x => x.v === min)) return [];
  return connues.filter(x => x.v === min).map(x => x.i);
}

export function analyser(colonnes: ColonneAnalyse[], unite: Unite | null): string[] {
  const phrases: string[] = [];
  const unitaires = unite ? plusPetits(colonnes.map(c => c.prixUnite)) : [];
  if (unite && unitaires.length === 1) {
    const i = unitaires[0], c = colonnes[i];
    const max = Math.max(...colonnes.flatMap(x => (x.prixUnite != null ? [x.prixUnite] : [])));
    const ecart = Math.round((1 - c.prixUnite! / max) * 100);
    phrases.push(`${libellePrixUnitaire(unite).replace('Prix', 'Le moins cher')} : ${nomCourt(c.nom)}, ${prixUnitaireLisible(c.prixUnite!, unite)}${ecart >= 5 ? `, ${ecart} % de moins que le plus cher` : ''}.`);
    const moinsChere = plusPetits(colonnes.map(x => x.prix));
    if (moinsChere.length === 1 && moinsChere[0] !== i && colonnes[moinsChere[0]].prixUnite != null) {
      phrases.push(`${nomCourt(colonnes[moinsChere[0]].nom)} coûte moins à l’achat, mais revient plus cher ${libellePrixUnitaire(unite).replace('Prix ', '')}.`);
    }
  } else {
    const moinsChere = plusPetits(colonnes.map(x => x.prix));
    if (moinsChere.length === 1) {
      const c = colonnes[moinsChere[0]];
      phrases.push(`Le moins cher à l’achat : ${nomCourt(c.nom)}, ${euros(c.prix!)}. Les quantités ne se comparent pas toutes : vérifie la contenance.`);
    }
  }
  const notes = colonnes.map(c => (c.nutriscore ? 'abcde'.indexOf(c.nutriscore) : null));
  const nutri = plusPetits(notes);
  if (nutri.length === 1) phrases.push(`Meilleur Nutri-Score : ${nomCourt(colonnes[nutri[0]].nom)} (${colonnes[nutri[0]].nutriscore!.toUpperCase()}).`);
  const nova = plusPetits(colonnes.map(c => c.nova));
  if (nova.length === 1) phrases.push(`Le moins transformé : ${nomCourt(colonnes[nova[0]].nom)} (NOVA ${colonnes[nova[0]].nova}).`);
  const promo = colonnes.find(c => c.promotion);
  if (promo) phrases.push(`En promotion : ${nomCourt(promo.nom)}, ${promo.promotion}.`);
  const absent = colonnes.find(c => !c.disponible);
  if (absent) phrases.push(`Indisponible au drive : ${nomCourt(absent.nom)}.`);
  return phrases.slice(0, 4);
}
