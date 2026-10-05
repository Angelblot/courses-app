/**
 * Les caractéristiques qui se comparent, lues dans le texte d'un produit : son
 * libellé, puis le texte de sa fiche sur le drive quand l'extension l'a lu.
 * « Papier cuisson 15 m », « 20 feuilles de 38 x 42cm », « 290 mm x 50 m »,
 * « Lessive 40 lavages », « Allumettes 2x75g »… Chaque produit a ses mesures ;
 * certaines se convertissent (un rouleau et des feuilles se comparent au m²,
 * ou en mètres équivalents, estimés). Le comparatif retient la mesure qui
 * couvre le plus de produits et en tire un prix comparable.
 * Rien ici ne parle à Supabase.
 */

/** Les mesures reconnues, de la plus parlante à la plus générique. */
export type Unite = 'm' | 'm2' | 'feuille' | 'rouleau' | 'lavage' | 'dose' | 'g' | 'ml' | 'piece';
export const ORDRE_UNITES: Unite[] = ['m', 'm2', 'feuille', 'rouleau', 'lavage', 'dose', 'g', 'ml', 'piece'];

/** Des mesures, dont certaines estimées (« ≈ ») : des feuilles converties en mètres. */
export type Mesures = Partial<Record<Unite, number>> & { estime?: Partial<Record<Unite, true>> };

const plat = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nombre = (s: string) => Number(s.replace(',', '.'));
const enCm = (v: number, u: string) => (u === 'mm' ? v / 10 : u === 'm' ? v * 100 : v);
const arrondi = (v: number, n = 3) => Math.round(v * 10 ** n) / 10 ** n;

/** Familles de mots, au singulier comme au pluriel. */
const MOTS: { unite: Unite; motif: string }[] = [
  { unite: 'feuille', motif: 'feuilles?|f\\.' },
  { unite: 'rouleau', motif: 'rouleaux?' },
  { unite: 'lavage', motif: 'lavages?' },
  { unite: 'dose', motif: 'doses?|capsules?|pastilles?|tablettes?|sachets?|dosettes?|pods?' },
  { unite: 'piece', motif: 'lingettes?|mouchoirs?|couches?|pieces?|pcs|unites?|oeufs?|piles?|sacs?|serviettes?|filtres?|cotons?|disques?|batonnets?' },
];

/** Les mesures d'un texte, sans conversion. */
function brutes(texte: string): Mesures & { largeurCm?: number; feuilleCm?: [number, number] } {
  const t = ` ${plat(texte)} `;
  const m: Mesures & { largeurCm?: number; feuilleCm?: [number, number] } = {};
  const lot = t.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|cl|ml|l)\b/);
  const multiple = lot ? Number(lot[1]) : 1;

  const poids = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|g)\b/);
  if (poids) m.g = arrondi(nombre(poids[1]) * (poids[2] === 'kg' ? 1000 : 1) * (lot && /k?g/.test(lot[3]) ? multiple : 1), 1);
  const volume = t.match(/(\d+(?:[.,]\d+)?)\s*(cl|ml|l)\b/);
  if (volume) m.ml = Math.round(nombre(volume[1]) * ({ l: 1000, cl: 10, ml: 1 } as const)[volume[2] as 'l' | 'cl' | 'ml'] * (lot && /l$/.test(lot[3]) ? multiple : 1));

  // Un rouleau donné avec sa largeur : « 290 mm x 50 m », « 50 m x 440 mm », « 8 m x 38 cm ».
  const rouleau = t.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*m\b/) ?? t.match(/(\d+(?:[.,]\d+)?)\s*m\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm)\b/);
  if (rouleau) {
    const [largeur, uLargeur, longueur] = rouleau[3] && /mm|cm/.test(rouleau[2]) ? [rouleau[1], rouleau[2], rouleau[3]] : [rouleau[2], rouleau[3], rouleau[1]];
    m.m = nombre(longueur); m.largeurCm = enCm(nombre(largeur), uLargeur);
  } else {
    const longueur = t.match(/(\d+(?:[.,]\d+)?)\s*(?:m|metres?)\b(?!\s*l)/);
    if (longueur) m.m = nombre(longueur[1]);
  }
  // La taille d'une feuille ou d'une pièce : « 38 x 42cm », « 258x425 mm ».
  const taille = t.match(/(\d+(?:[.,]\d+)?)\s*(?:cm|mm)?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm)\b/);
  if (taille && !rouleau) m.feuilleCm = [enCm(nombre(taille[1]), taille[3]), enCm(nombre(taille[2]), taille[3])];

  for (const { unite, motif } of MOTS) {
    const r = t.match(new RegExp(`(\\d+)\\s*[x×]\\s*(\\d+)\\s*(?:${motif})(?![a-z])`)) ?? t.match(new RegExp(`(\\d+)\\s*(?:${motif})(?![a-z])`));
    if (r) (m as Record<string, number>)[unite] = r.length > 2 && r[2] ? Number(r[1]) * Number(r[2]) : Number(r[1]);
  }
  // « x12 » ou « lot de 3 » seul : un nombre de pièces, seulement si rien d'autre n'a été lu.
  if (!Object.keys(m).length) {
    const pieces = t.match(/(?:\bx\s*(\d+)\b|\blot de (\d+)\b|\b(\d+)\s*x\b(?!\s*\d))/);
    if (pieces) m.piece = Number(pieces[1] ?? pieces[2] ?? pieces[3]);
  }
  return m;
}

/**
 * Les mesures d'un produit, du libellé d'abord puis de la fiche : le libellé
 * l'emporte, la fiche complète. Puis les conversions : la surface d'un rouleau
 * dont on connaît la largeur, ou de feuilles dont on connaît la taille ; et,
 * sans largeur de rouleau à opposer, des feuilles en mètres équivalents (leur
 * grand côté mis bout à bout), marqués estimés.
 */
export function lireMesures(libelle: string, fiche?: string | null): Mesures {
  const a = brutes(libelle), b = fiche ? brutes(fiche) : {};
  const m: ReturnType<typeof brutes> = { ...b, ...Object.fromEntries(Object.entries(a).filter(([, v]) => v != null)) };
  const sortie: Mesures = {};
  for (const u of ORDRE_UNITES) { const v = (m as Record<string, unknown>)[u]; if (typeof v === 'number' && Number.isFinite(v) && v > 0) sortie[u] = v; }
  const pieces = m.feuille ?? m.piece;
  if (m.m && m.largeurCm) sortie.m2 = arrondi(m.m * m.largeurCm / 100);
  else if (pieces && m.feuilleCm) sortie.m2 = arrondi(pieces * m.feuilleCm[0] * m.feuilleCm[1] / 10_000);
  if (!sortie.m && m.feuille && m.feuilleCm) {
    sortie.m = arrondi(m.feuille * Math.max(...m.feuilleCm) / 100, 2);
    sortie.estime = { m: true };
  }
  return sortie;
}

/**
 * La mesure qui sert à comparer : celle que portent le plus de produits ; à
 * égalité, celle qui en estime le moins, puis la plus parlante. null s'il n'y
 * en a aucune commune à au moins deux produits.
 */
export function uniteCommune(mesures: Mesures[]): Unite | null {
  let meilleure: Unite | null = null, compte = 1, estimes = Infinity;
  for (const u of ORDRE_UNITES) {
    const n = mesures.filter(m => m[u] != null).length, e = mesures.filter(m => m[u] != null && m.estime?.[u]).length;
    if (n > compte || (n === compte && n > 1 && e < estimes)) { meilleure = u; compte = n; estimes = e; }
  }
  return meilleure;
}

const decimal = (v: number) => String(v).replace('.', ',');
const LIBELLES: Record<Unite, { contenance: (v: number) => string; prix: string; par: number; suffixe: string }> = {
  m: { contenance: v => `${decimal(v)} m`, prix: 'Prix au mètre', par: 1, suffixe: '/m' },
  m2: { contenance: v => `${decimal(v)} m²`, prix: 'Prix au m²', par: 1, suffixe: '/m²' },
  feuille: { contenance: v => `${v} feuille${v > 1 ? 's' : ''}`, prix: 'Prix à la feuille', par: 1, suffixe: '/feuille' },
  rouleau: { contenance: v => `${v} rouleau${v > 1 ? 'x' : ''}`, prix: 'Prix au rouleau', par: 1, suffixe: '/rouleau' },
  lavage: { contenance: v => `${v} lavage${v > 1 ? 's' : ''}`, prix: 'Prix au lavage', par: 1, suffixe: '/lavage' },
  dose: { contenance: v => `${v} dose${v > 1 ? 's' : ''}`, prix: 'Prix à la dose', par: 1, suffixe: '/dose' },
  g: { contenance: v => v >= 1000 ? `${decimal(v / 1000)} kg` : `${v} g`, prix: 'Prix au kilo', par: 1000, suffixe: '/kg' },
  ml: { contenance: v => v >= 1000 ? `${decimal(v / 1000)} L` : `${v} ml`, prix: 'Prix au litre', par: 1000, suffixe: '/L' },
  piece: { contenance: v => `${v} pièce${v > 1 ? 's' : ''}`, prix: 'Prix à la pièce', par: 1, suffixe: '/pièce' },
};

/** « 15 m », « 20 feuilles », « 1,5 kg », « 3,19 m² ». */
export const contenanceLisible = (u: Unite, v: number) => LIBELLES[u].contenance(v);
/** « Prix au mètre », « Prix au m² ». */
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
