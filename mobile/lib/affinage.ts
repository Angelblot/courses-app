/**
 * « Quel type ? » dans Préciser : un article noté largement (« Bières »)
 * se précise en un tap (« Bière IPA »). Les types viennent d'une liste écrite
 * par famille de produits, complétée par les mots qui reviennent dans les
 * libellés trouvés ; les marques sont à part. Le filtre est instantané sur
 * les offres déjà relevées ; la recherche approfondie part sur les drives.
 * Rien ici ne parle à Supabase.
 */
import { normaliserNom } from './session-courses.ts';

/** Les types courants, par famille. La clé est le mot cherché, normalisé et au singulier. */
const FAMILLES: Record<string, string[]> = {
  biere: ['IPA', 'Blonde', 'Blanche', 'Ambrée', 'Brune', 'Sans alcool'],
  vin: ['Rouge', 'Blanc', 'Rosé', 'Bordeaux', 'Bourgogne'],
  cafe: ['Grains', 'Moulu', 'Capsules', 'Dosettes', 'Décaféiné'],
  the: ['Vert', 'Noir', 'Earl Grey', 'Menthe'],
  tisane: ['Verveine', 'Camomille', 'Tilleul', 'Menthe', 'Fruits rouges'],
  infusion: ['Verveine', 'Camomille', 'Tilleul', 'Menthe', 'Fruits rouges'],
  jus: ['Orange', 'Pomme', 'Multifruits', 'Raisin', 'Ananas'],
  eau: ['Plate', 'Gazeuse', 'Pétillante', 'Aromatisée'],
  lait: ['Demi-écrémé', 'Entier', 'Écrémé', 'Sans lactose', 'Avoine', 'Amande'],
  yaourt: ['Nature', 'Aux fruits', 'Grec', 'Vanille', 'Brebis'],
  fromage: ['Chèvre', 'Comté', 'Emmental', 'Raclette', 'Brebis', 'Râpé'],
  chevre: ['Bûche', 'Frais', 'Sec', 'Cendré'],
  dessert: ['Chocolat', 'Vanille', 'Caramel', 'Crème brûlée', 'Liégeois'],
  creme: ['Fraîche', 'Liquide', 'Épaisse', 'Légère', 'Dessert'],
  crepe: ['Chocolat', 'Froment', 'Fourrées', 'Jambon emmental', 'Dentelles'],
  gressin: ['Sésame', 'Romarin', 'Huile d’olive', 'Olives', 'Nature'],
  chips: ['Nature', 'Paprika', 'Barbecue', 'Vinaigre', 'Ondulées'],
  biscuit: ['Chocolat', 'Petit beurre', 'Sablés', 'Fourrés', 'Apéritif'],
  cereale: ['Chocolat', 'Muesli', 'Granola', 'Flocons d’avoine', 'Miel'],
  pate: ['Spaghetti', 'Penne', 'Coquillettes', 'Fusilli', 'Complètes'],
  riz: ['Basmati', 'Thaï', 'Complet', 'Risotto', 'Rond'],
  javel: ['Eau de javel', 'Gel', 'Pastilles', 'Spray', 'Parfumée'],
  'liquide vaisselle': ['Peaux sensibles', 'Dégraissant', 'Citron', 'Anti-odeur', 'Écologique'],
  lessive: ['Liquide', 'Capsules', 'Poudre', 'Couleurs', 'Peaux sensibles'],
  wc: ['Gel', 'Bloc', 'Disques', 'Détartrant', 'Javel'],
  desodorisant: ['Spray', 'Petit coin', 'Textile', 'Diffuseur', 'Recharge'],
  savon: ['Liquide', 'Solide', 'Recharge', 'Surgras'],
  shampoing: ['Doux', 'Antipelliculaire', 'Cheveux secs', 'Solide'],
};

const VIDES = new Set('de du des d la le les l au aux a et avec pour en x par sur un une pack lot format offre maxi mini bio nature original classic carrefour reflets france simpl essential expert extra eco planet sensation'.split(' '));
const singulier = (m: string) => m.length > 3 ? m.replace(/(s|x)$/, '') : m;
const mots = (s: string) => normaliserNom(s).split(' ').filter(Boolean).map(singulier);

/**
 * La famille d'un article : une expression connue (« Liquides vaisselle »),
 * sinon le dernier de ses mots qui en est une, le plus précis (« Eau de javel »
 * → javel, « Crème dessert » → dessert).
 */
export function famille(requete: string): string | null {
  const m = mots(requete), texte = m.join(' ');
  const expression = Object.keys(FAMILLES).find(k => k.includes(' ') && texte.includes(k));
  return expression ?? [...m].reverse().find(x => x in FAMILLES) ?? null;
}

/** Les types courants d'une famille, pour les recherches préparées à l'avance. */
export function typesDeFamille(fam: string): string[] {
  return FAMILLES[fam] ?? [];
}

/** « Bières » + « IPA » → « Bière IPA ». Le point garde son nom ; seule la recherche change. */
export function requeteAffinee(requete: string, terme: string): string {
  const base = requete.trim().split(/\s+/).map(m => m.length > 3 && /[sx]$/i.test(m) ? m.slice(0, -1) : m).join(' ');
  return `${base} ${terme.trim()}`.replace(/\s+/g, ' ');
}

/** Un libellé correspond au type ou à la marque choisis : tous ses mots y sont. */
export function correspond(libelle: string, terme: string): boolean {
  // Mots entiers (« Gel » ne trouve pas « gelée ») ; les mots vides du type ne comptent pas (« Eau de javel »).
  const l = new Set(mots(libelle)), utiles = mots(terme).filter(m => !VIDES.has(m));
  return utiles.length > 0 && utiles.every(m => l.has(m));
}

/** La marque d'un libellé Carrefour (« LEFFE Bière… LEFFE »), ou celle relevée par le drive. */
export function marqueDe(o: { libelle: string; marque?: string | null }): string | null {
  if (o.marque) return o.marque.trim();
  const m = o.libelle.match(/^([A-Z0-9][A-Z0-9'’&!. -]{1,40}?)\s+(?=[A-ZÀ-Ý][a-zà-ÿ])/);
  return m ? m[1].trim() : null;
}
const joli = (t: string) => t.toLowerCase().replace(/(^|[\s'’-])([a-zà-ÿ])/g, (_, a, b) => a + b.toUpperCase());

export type Suggestion = { nom: string; n: number };

/**
 * Le libellé parle-t-il de l'article ? Un de ses mots commence par un mot du
 * nom cherché (« Brie de Meaux » pour « Brie »). Sert à écarter ce qu'un drive
 * renvoie faute de mieux (du poulet pour « Brie Fromager »).
 */
export function parleDe(libelle: string, requete: string): boolean {
  const racines = mots(requete).filter(r => !VIDES.has(r)), m = mots(libelle);
  return racines.some(r => m.some(x => x.startsWith(r) || (r.startsWith(x) && x.length >= 4)));
}

/**
 * Types et marques à proposer pour un article, d'après les offres trouvées.
 * Les types de la famille viennent d'abord, même absents des résultats : c'est
 * ce qui fait apparaître « IPA » quand le drive n'en montre qu'une. Seules les
 * offres qui parlent de l'article comptent (pas les vins glissés parmi les bières).
 */
export function suggestions(requete: string, offres: { libelle: string; marque?: string | null }[], max = 6): { types: Suggestion[]; marques: Suggestion[] } {
  const racines = mots(requete);
  const pertinentes = offres.filter(o => parleDe(o.libelle, requete));
  const compte = (t: string) => pertinentes.filter(o => correspond(o.libelle, t)).length;
  // Les marques, d'abord : elles ne doivent pas passer pour des types.
  const parMarque = new Map<string, number>();
  for (const o of pertinentes) { const m = marqueDe(o); if (m) { const k = joli(m); parMarque.set(k, (parMarque.get(k) ?? 0) + 1); } }
  const marques = [...parMarque].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([nom, n]) => ({ nom, n }));
  const motsMarques = new Set(marques.flatMap(m => mots(m.nom)));
  const fam = famille(requete);
  const connus = (fam ? FAMILLES[fam] : []).map(nom => ({ nom, n: compte(nom) }));
  // Puis les mots qui reviennent dans les libellés, hors marques, mesures et mots vides.
  const df = new Map<string, { nom: string; n: number }>();
  for (const o of pertinentes) {
    const sansMarque = o.libelle.replace(/^([A-Z0-9][A-Z0-9'’&!. -]{1,40}?)\s+(?=[A-ZÀ-Ý][a-zà-ÿ])/, '').replace(/\s[A-Z0-9'’&!. -]{2,}$/, '');
    const vus = new Set<string>();
    for (const brut of sansMarque.replace(/\d+([.,]\d+)?\s*(%|°|g|kg|ml|cl|l|m|cm|x)?/gi, ' ').split(/[^A-Za-zÀ-ÿ'’-]+/)) {
      const w = brut.replace(/^[dl]['’]/i, '');
      const k = singulier(normaliserNom(w));
      if (k.length < 3 || VIDES.has(k) || racines.includes(k) || motsMarques.has(k) || /^[A-Z]{2,}$/.test(w) || vus.has(k)) continue;
      vus.add(k);
      const e = df.get(k) ?? { nom: joli(w), n: 0 }; e.n += 1; df.set(k, e);
    }
  }
  const dejaDits = new Set(connus.flatMap(c => mots(c.nom)));
  const tires = [...df.entries()].filter(([k, e]) => e.n >= 2 && e.n <= Math.max(2, pertinentes.length * 0.7) && !dejaDits.has(k))
    .sort((a, b) => b[1].n - a[1].n).map(([, e]) => e);
  const types = [...connus, ...tires].slice(0, max);
  return { types, marques };
}
