/**
 * Historique des prix d'un produit : les lignes de factures (purchase_lines)
 * et les prix relevés par l'extension au moment de remplir le panier
 * (offres_drive marquées `choisi`). Rien ici ne parle à Supabase.
 */

export type LigneAchat = {
  purchase_date: string;
  drive: string | null;
  magasin: string | null;
  commande: string | null;
  quantity_delivered: number | null;
  unit_price_ttc: number | null;
  remise_ttc: number | null;
  total_ttc: number | null;
};

export type PrixReleve = { vu_le: string; drive: string; prix: number | null; promotion: string | null };

export type Achat = {
  /** Jour, AAAA-MM-JJ. */
  jour: string;
  drive: string;
  /** Lieu lisible : « Lattes », « Market Le Crès », « E.Leclerc ». */
  lieu: string;
  /** Prix affiché, à l'unité. */
  affiche: number;
  /** Prix réellement payé, à l'unité, remise déduite. */
  paye: number;
  quantite: number;
  /** Remise en part du prix affiché (0,3 pour −30 %), 0 sans remise. */
  remise: number;
  /** Relevé par l'extension plutôt que lu sur une facture. */
  releve: boolean;
};

export type Historique = {
  achats: Achat[];
  dernier: Achat | null;
  /** Écart du dernier prix payé avec le premier, en part (−0,15 pour −15 %). */
  ecart: number | null;
  depuis: string | null;
};

const ENSEIGNES: Record<string, string> = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' };
const arrondi = (v: number) => Math.round(v * 100) / 100;

/** « Carrefour Market Le Crès » → « Market Le Crès » ; sans magasin, l'enseigne. */
export function lieuDe(magasin: string | null, drive: string): string {
  const m = (magasin ?? '').trim();
  const enseigne = ENSEIGNES[drive] ?? drive;
  if (!m) return enseigne;
  const sans = m.replace(new RegExp(`^${enseigne.replace('.', '\\.')}\\s+`, 'i'), '').trim();
  return sans || enseigne;
}

/**
 * Fusionne factures et relevés, du plus ancien au plus récent. Un relevé du
 * même jour et de la même enseigne qu'une facture est écarté : la facture
 * dit ce qui a vraiment été payé. Les produits manquants (rien de livré) ne
 * comptent pas.
 */
export function historiquePrix(lignes: LigneAchat[], releves: PrixReleve[] = []): Historique {
  const achats: Achat[] = [];
  for (const l of lignes) {
    const q = Number(l.quantity_delivered ?? 0), pu = Number(l.unit_price_ttc ?? 0);
    if (q <= 0 || pu <= 0) continue;
    const drive = l.drive ?? 'carrefour';
    const remiseTotale = -Number(l.remise_ttc ?? 0);
    const total = l.total_ttc != null ? Number(l.total_ttc) : pu * q - remiseTotale;
    achats.push({
      jour: l.purchase_date.slice(0, 10), drive, lieu: lieuDe(l.magasin, drive),
      affiche: pu, paye: arrondi(total / q), quantite: q,
      remise: remiseTotale > 0 ? Math.round((remiseTotale / (pu * q)) * 100) / 100 : 0, releve: false,
    });
  }
  const factures = new Set(achats.map(a => `${a.jour}|${a.drive}`));
  const vus = new Set<string>();
  for (const r of releves) {
    if (r.prix == null || r.prix <= 0) continue;
    const jour = r.vu_le.slice(0, 10), cle = `${jour}|${r.drive}`;
    if (factures.has(cle) || vus.has(cle)) continue;
    vus.add(cle);
    achats.push({ jour, drive: r.drive, lieu: lieuDe(null, r.drive), affiche: r.prix, paye: r.prix, quantite: 1, remise: 0, releve: true });
  }
  // Deux lignes du même produit le même jour (format différent, remplacement)
  // se regroupent : un seul point par jour et par enseigne.
  const parJour = new Map<string, Achat>();
  for (const a of achats) {
    const cle = `${a.jour}|${a.drive}|${a.lieu}`, d = parJour.get(cle);
    if (!d) { parJour.set(cle, a); continue; }
    const q = d.quantite + a.quantite;
    const affiche = arrondi((d.affiche * d.quantite + a.affiche * a.quantite) / q);
    const paye = arrondi((d.paye * d.quantite + a.paye * a.quantite) / q);
    parJour.set(cle, { ...d, quantite: q, affiche, paye, remise: affiche > 0 ? Math.max(0, Math.round((1 - paye / affiche) * 100) / 100) : 0 });
  }
  const tries = [...parJour.values()].sort((a, b) => a.jour.localeCompare(b.jour));
  const dernier = tries.at(-1) ?? null, premier = tries[0];
  const ecart = dernier && premier && tries.length > 1 ? Math.round((dernier.paye / premier.paye - 1) * 1000) / 1000 : null;
  return { achats: tries, dernier, ecart, depuis: premier && tries.length > 1 ? premier.jour : null };
}

const JOUR = 86400000;

/**
 * Échelle du temps : chaque date entre 0 et 1, mais un trou de plus de
 * `seuil` jours se resserre à la largeur d'un écart ordinaire, et l'axe le
 * signale par une coupure (sa position, entre 0 et 1).
 */
export function echelleTemps(jours: string[], seuil = 120): { x: (jour: string) => number; coupures: number[] } {
  const uniques = [...new Set(jours)].sort();
  if (uniques.length < 2) return { x: () => 0.5, coupures: [] };
  const t = uniques.map(j => Date.parse(j) / JOUR);
  const ecarts = t.slice(1).map((v, i) => v - t[i]);
  const ordinaires = ecarts.filter(e => e <= seuil);
  const resserre = Math.max(30, ordinaires.length ? Math.max(...ordinaires) : 45);
  const positions = [0];
  const coupures: number[] = [];
  ecarts.forEach((e, i) => {
    const pas = e > seuil ? resserre : e;
    if (e > seuil) coupures.push(positions[i] + pas / 2);
    positions.push(positions[i] + pas);
  });
  const total = positions.at(-1)!;
  const index = new Map(uniques.map((j, i) => [j, positions[i] / total]));
  return {
    x: (jour: string) => index.get(jour) ?? (() => {
      // Une date absente se place entre ses deux voisines connues.
      const v = Date.parse(jour) / JOUR, i = t.findIndex(w => w >= v);
      if (i <= 0) return i === 0 ? 0 : 1;
      return (positions[i - 1] + ((v - t[i - 1]) / (t[i] - t[i - 1])) * (positions[i] - positions[i - 1])) / total;
    })(),
    coupures: coupures.map(c => c / total),
  };
}

/** Trois repères ronds (pas de 0,1 / 0,2 / 0,5 / 1…) couvrant les prix. */
export function reperesPrix(valeurs: number[]): { min: number; max: number; reperes: number[] } {
  const bas = Math.min(...valeurs), haut = Math.max(...valeurs);
  const etendue = Math.max(haut - bas, haut * 0.1, 0.1);
  const brut = etendue / 2;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map(m => m * puissance).find(p => p >= brut) ?? brut;
  const min = Math.floor((bas - etendue * 0.1) / pas) * pas;
  const reperes: number[] = [];
  for (let v = min; v <= haut + pas * 0.999; v += pas) reperes.push(Math.round(v * 100) / 100);
  if (reperes.length < 2) reperes.push(Math.round((min + pas) * 100) / 100);
  return { min: reperes[0], max: reperes.at(-1)!, reperes };
}
