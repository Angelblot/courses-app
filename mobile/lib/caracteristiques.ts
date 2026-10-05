/**
 * Les caractéristiques qui se comparent, lues dans le libellé d'un produit :
 * « Papier cuisson 15 m », « 20 feuilles », « Lessive 40 lavages »,
 * « Allumettes 2x75g ». Chaque produit a sa mesure ; le comparatif retient
 * celle que partagent le plus de produits et en tire un prix comparable.
 * Rien ici ne parle à Supabase.
 */

/** Les mesures reconnues, de la plus parlante à la plus générique. */
export type Unite = 'm' | 'feuille' | 'rouleau' | 'lavage' | 'dose' | 'g' | 'ml' | 'piece';
export const ORDRE_UNITES: Unite[] = ['m', 'feuille', 'rouleau', 'lavage', 'dose', 'g', 'ml', 'piece'];

export type Mesures = Partial<Record<Unite, number>>;

const plat = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nombre = (s: string) => Number(s.replace(',', '.'));

/** Familles de mots, au singulier comme au pluriel. */
const MOTS: { unite: Unite; motif: string }[] = [
  { unite: 'feuille', motif: 'feuilles?|f\\.' },
  { unite: 'rouleau', motif: 'rouleaux?' },
  { unite: 'lavage', motif: 'lavages?' },
  { unite: 'dose', motif: 'doses?|capsules?|pastilles?|tablettes?|sachets?|dosettes?|pods?' },
  { unite: 'piece', motif: 'lingettes?|mouchoirs?|couches?|pieces?|unites?|oeufs?|piles?|sacs?|serviettes?|filtres?|cotons?|disques?|batonnets?' },
];

/**
 * Les mesures d'un libellé. Un lot « 2 x 75 g » ou « 4 x 20 sachets » compte
 * pour le tout ; « x12 » seul, ou « lot de 3 », donne un nombre de pièces.
 * Les centimètres ne comptent pas : « 15 m x 30 cm », c'est 15 m de long.
 */
export function lireMesures(libelle: string): Mesures {
  const t = ` ${plat(libelle)} `;
  const m: Mesures = {};
  const lot = t.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|cl|ml|l)\b/);
  const multiple = lot ? Number(lot[1]) : 1;

  const poids = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|g)\b/);
  if (poids) m.g = Math.round(nombre(poids[1]) * (poids[2] === 'kg' ? 1000 : 1) * (lot && /k?g/.test(lot[3]) ? multiple : 1) * 10) / 10;
  const volume = t.match(/(\d+(?:[.,]\d+)?)\s*(cl|ml|l)\b/);
  if (volume) m.ml = Math.round(nombre(volume[1]) * ({ l: 1000, cl: 10, ml: 1 } as const)[volume[2] as 'l' | 'cl' | 'ml'] * (lot && /l$/.test(lot[3]) ? multiple : 1));
  const longueur = t.match(/(\d+(?:[.,]\d+)?)\s*(?:m|metres?)\b(?!\s*l)/);
  if (longueur) m.m = nombre(longueur[1]);

  for (const { unite, motif } of MOTS) {
    const r = t.match(new RegExp(`(\\d+)\\s*[x×]\\s*(\\d+)\\s*(?:${motif})(?![a-z])`)) ?? t.match(new RegExp(`(\\d+)\\s*(?:${motif})(?![a-z])`));
    if (r) m[unite] = r.length > 2 && r[2] ? Number(r[1]) * Number(r[2]) : Number(r[1]);
  }
  if (!Object.keys(m).length) {
    const pieces = t.match(/(?:\bx\s*(\d+)\b|\blot de (\d+)\b|\b(\d+)\s*x\b(?!\s*\d))/);
    if (pieces) m.piece = Number(pieces[1] ?? pieces[2] ?? pieces[3]);
  }
  return Object.fromEntries(Object.entries(m).filter(([, v]) => Number.isFinite(v) && (v as number) > 0)) as Mesures;
}

/**
 * La mesure qui sert à comparer : celle que portent le plus de produits ;
 * à égalité, la plus parlante (mètres avant grammes, grammes avant pièces).
 * null s'il n'y en a aucune en commun à au moins deux produits.
 */
export function uniteCommune(mesures: Mesures[]): Unite | null {
  let meilleure: Unite | null = null, compte = 1;
  for (const u of ORDRE_UNITES) {
    const n = mesures.filter(m => m[u] != null).length;
    if (n > compte) { meilleure = u; compte = n; }
  }
  return meilleure;
}

const LIBELLES: Record<Unite, { contenance: (v: number) => string; prix: string; par: number; suffixe: string }> = {
  m: { contenance: v => `${String(v).replace('.', ',')} m`, prix: 'Prix au mètre', par: 1, suffixe: '/m' },
  feuille: { contenance: v => `${v} feuille${v > 1 ? 's' : ''}`, prix: 'Prix à la feuille', par: 1, suffixe: '/feuille' },
  rouleau: { contenance: v => `${v} rouleau${v > 1 ? 'x' : ''}`, prix: 'Prix au rouleau', par: 1, suffixe: '/rouleau' },
  lavage: { contenance: v => `${v} lavage${v > 1 ? 's' : ''}`, prix: 'Prix au lavage', par: 1, suffixe: '/lavage' },
  dose: { contenance: v => `${v} dose${v > 1 ? 's' : ''}`, prix: 'Prix à la dose', par: 1, suffixe: '/dose' },
  g: { contenance: v => v >= 1000 ? `${String(v / 1000).replace('.', ',')} kg` : `${v} g`, prix: 'Prix au kilo', par: 1000, suffixe: '/kg' },
  ml: { contenance: v => v >= 1000 ? `${String(v / 1000).replace('.', ',')} L` : `${v} ml`, prix: 'Prix au litre', par: 1000, suffixe: '/L' },
  piece: { contenance: v => `${v} pièce${v > 1 ? 's' : ''}`, prix: 'Prix à la pièce', par: 1, suffixe: '/pièce' },
};

/** « 15 m », « 20 feuilles », « 1,5 kg ». */
export const contenanceLisible = (u: Unite, v: number) => LIBELLES[u].contenance(v);
/** « Prix au mètre », « Prix au kilo ». */
export const libellePrixUnitaire = (u: Unite) => LIBELLES[u].prix;

/** Le prix ramené à la mesure commune : au mètre, au kilo (pour des grammes), au litre (pour des ml)… */
export function prixParUnite(prix: number | null, mesures: Mesures, u: Unite): number | null {
  const q = mesures[u];
  if (prix == null || !q) return null;
  return Math.round((prix / q) * LIBELLES[u].par * 1000) / 1000;
}

/** « 0,12 €/m » ; trois décimales sous 10 centimes, pour départager une feuille d'une autre. */
export function prixUnitaireLisible(v: number, u: Unite): string {
  const t = v < 0.1 ? v.toFixed(3) : v.toFixed(2);
  return `${t.replace('.', ',')} €${LIBELLES[u].suffixe}`;
}
