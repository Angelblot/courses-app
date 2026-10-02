/**
 * Commandes passées : les factures importées (purchase_lines) et les paniers
 * remplis par l'extension (cart_jobs, prix relevés dans offres_drive), et
 * leur comparaison avec les achats précédents ou entre drives. Rien ici ne
 * parle à Supabase.
 */

export type LigneCommande = {
  product_id: string | null;
  ean13: string | null;
  libelle: string;
  drive: string;
  /** Prix unitaire payé (facture) ou affiché au remplissage (panier). */
  prix: number | null;
  quantite: number;
  /** La ligne de la liste envoyée (panier) : la même sur chaque drive, même quand l'un met une alternative. */
  article?: string;
};

export type Commande = {
  /** `facture:<numéro>` ou `panier:<id du travail>`. */
  id: string;
  source: 'facture' | 'panier';
  /** AAAA-MM-JJ. */
  jour: string;
  drives: string[];
  lieu: string;
  total: number | null;
  lignes: LigneCommande[];
};

export type FactureLigne = {
  commande: string | null; purchase_date: string; drive: string | null; magasin: string | null;
  product_id: string | null; ean13: string | null; libelle: string | null;
  quantity_delivered: number | null; total_ttc: number | null; unit_price_ttc: number | null;
};

export type EntreeRemplissage = {
  item: string; ok: boolean; quantity?: number; label?: string;
  product_id?: string | null; prix?: number | null; ean?: string | null;
};

export type Remplissage = {
  id: string; status: string; created_at: string; finished_at?: string | null; drives?: string[];
  results: Record<string, EntreeRemplissage[]> | null;
};

export type OffreChoisie = { cart_job_id: string | null; drive: string; product_id: string | null; libelle: string; ean13: string | null; prix: number | null };

export const ENSEIGNES: Record<string, string> = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' };
const arrondi = (v: number) => Math.round(v * 100) / 100;
const plat = (t: string) => t.replace(/\s+/g, ' ').trim();

/** Une commande par numéro de facture ; les produits non livrés n'y figurent pas. */
export function commandesDesFactures(lignes: FactureLigne[]): Commande[] {
  const par = new Map<string, Commande>();
  for (const l of lignes) {
    if (!l.commande) continue;
    const q = Number(l.quantity_delivered ?? 0);
    if (q <= 0) continue;
    const drive = l.drive ?? 'carrefour';
    let c = par.get(l.commande);
    if (!c) {
      c = { id: `facture:${l.commande}`, source: 'facture', jour: l.purchase_date.slice(0, 10), drives: [drive], lieu: l.magasin ?? ENSEIGNES[drive] ?? drive, total: 0, lignes: [] };
      par.set(l.commande, c);
    }
    const total = l.total_ttc != null ? Number(l.total_ttc) : Number(l.unit_price_ttc ?? 0) * q;
    c.total = arrondi((c.total ?? 0) + total);
    c.lignes.push({ product_id: l.product_id, ean13: l.ean13, libelle: plat(l.libelle ?? ''), drive, prix: arrondi(total / q), quantite: q });
  }
  return [...par.values()];
}

/**
 * Un panier par remplissage terminé, une ligne par produit mis au panier sur
 * chaque drive. Le prix vient du compte rendu de l'extension, ou à défaut de
 * l'offre qu'elle a marquée choisie pendant ce remplissage.
 */
export function commandesDesPaniers(travaux: Remplissage[], offres: OffreChoisie[]): Commande[] {
  const parTravail = new Map<string, OffreChoisie[]>();
  for (const o of offres) if (o.cart_job_id) parTravail.set(o.cart_job_id, [...(parTravail.get(o.cart_job_id) ?? []), o]);
  const commandes: Commande[] = [];
  for (const t of travaux) {
    if (t.status !== 'done' || !t.results) continue;
    const choisies = parTravail.get(t.id) ?? [];
    const lignes: LigneCommande[] = [];
    for (const [drive, entrees] of Object.entries(t.results)) {
      for (const e of entrees ?? []) {
        if (!e?.ok) continue;
        const libelle = plat(e.label ?? e.item ?? '');
        const offre = choisies.find(o => o.drive === drive && plat(o.libelle) === libelle);
        lignes.push({
          product_id: e.product_id ?? offre?.product_id ?? null, ean13: e.ean ?? offre?.ean13 ?? null,
          libelle, drive, prix: e.prix ?? offre?.prix ?? null, quantite: Math.max(1, Number(e.quantity ?? 1)), article: plat(e.item ?? '').toLowerCase() || undefined,
        });
      }
    }
    if (!lignes.length) continue;
    const drives = [...new Set(lignes.map(l => l.drive))];
    const chiffres = lignes.filter(l => l.prix != null);
    commandes.push({
      id: `panier:${t.id}`, source: 'panier', jour: (t.finished_at ?? t.created_at).slice(0, 10), drives,
      lieu: drives.map(d => ENSEIGNES[d] ?? d).join(' et '),
      total: chiffres.length ? arrondi(chiffres.reduce((s, l) => s + l.prix! * l.quantite, 0)) : null, lignes,
    });
  }
  return commandes;
}

const JOUR = 86400000;

/**
 * Les deux sources, de la plus récente à la plus ancienne. Un panier suivi,
 * dans la semaine, d'une facture du même drive est la même commande : la
 * facture, qui dit ce qui a été payé, le remplace.
 */
export function toutesCommandes(factures: Commande[], paniers: Commande[]): Commande[] {
  const gardes = paniers.filter(p => !factures.some(f => {
    const ecart = (Date.parse(f.jour) - Date.parse(p.jour)) / JOUR;
    return ecart >= 0 && ecart <= 7 && f.drives.some(d => p.drives.includes(d));
  }));
  return [...factures, ...gardes].sort((a, b) => b.jour.localeCompare(a.jour) || a.id.localeCompare(b.id));
}

const memeProduit = (a: LigneCommande, b: LigneCommande) =>
  (!!a.product_id && a.product_id === b.product_id) || (!!a.ean13 && a.ean13 === b.ean13);

export type Evolution = {
  ligne: LigneCommande;
  avant: { prix: number; jour: string; lieu: string; drive: string } | null;
  /** −0,15 pour −15 % ; null pour un produit nouveau ou sans prix. */
  ecart: number | null;
};

export type ComparaisonHistorique = {
  evolutions: Evolution[];
  communs: number;
  nouveaux: number;
  totalAvant: number;
  totalMaintenant: number;
  ecart: number | null;
  baisses: number; stables: number; hausses: number;
};

/**
 * Chaque produit de la commande (d'un drive) face à son dernier achat avant
 * elle, quel que soit le magasin. On compare les produits déjà achetés, pas
 * le total : une commande plus grosse n'est pas plus chère.
 */
export function comparerHistorique(commande: Commande, toutes: Commande[], drive?: string): ComparaisonHistorique {
  const anterieures = toutes.filter(c => c.id !== commande.id && c.jour < commande.jour).sort((a, b) => b.jour.localeCompare(a.jour));
  const lignes = commande.lignes.filter(l => !drive || l.drive === drive);
  const vus = new Set<string>();
  const evolutions: Evolution[] = [];
  for (const ligne of lignes) {
    const cle = ligne.product_id ?? ligne.ean13 ?? ligne.libelle;
    if (vus.has(`${ligne.drive}|${cle}`)) continue;
    vus.add(`${ligne.drive}|${cle}`);
    let avant: Evolution['avant'] = null;
    for (const c of anterieures) {
      const l = c.lignes.find(x => x.prix != null && memeProduit(x, ligne));
      if (l) { avant = { prix: l.prix!, jour: c.jour, lieu: c.lieu, drive: l.drive }; break; }
    }
    const ecart = avant && ligne.prix != null ? Math.round((ligne.prix / avant.prix - 1) * 1000) / 1000 : null;
    evolutions.push({ ligne, avant, ecart });
  }
  const chiffres = evolutions.filter(e => e.ecart != null);
  const totalAvant = arrondi(chiffres.reduce((s, e) => s + e.avant!.prix, 0));
  const totalMaintenant = arrondi(chiffres.reduce((s, e) => s + e.ligne.prix!, 0));
  const stable = (e: Evolution) => Math.abs(e.ligne.prix! - e.avant!.prix) < 0.01;
  return {
    evolutions: evolutions.sort((a, b) => (b.ecart ?? -Infinity) - (a.ecart ?? -Infinity)),
    communs: chiffres.length,
    nouveaux: evolutions.filter(e => !e.avant).length,
    totalAvant, totalMaintenant,
    ecart: chiffres.length && totalAvant > 0 ? Math.round((totalMaintenant / totalAvant - 1) * 1000) / 1000 : null,
    baisses: chiffres.filter(e => !stable(e) && e.ecart! < 0).length,
    stables: chiffres.filter(stable).length,
    hausses: chiffres.filter(e => !stable(e) && e.ecart! > 0).length,
  };
}

export type FaceAFace = { libelle: string; libelles: Record<string, string>; prix: Record<string, number>; moinsCher: string | null; ecart: number };

export type ComparaisonDrives = {
  drives: string[];
  /** Produits trouvés partout, avec un prix sur chaque drive. */
  communs: FaceAFace[];
  totaux: Record<string, number>;
  /** Le drive le moins cher sur les produits communs, et l'écart en euros avec le suivant. */
  moinsCher: string | null;
  economie: number;
  /** Produits trouvés sur un seul drive : ils manquent sur les autres. */
  seulement: Record<string, LigneCommande[]>;
  /** Produits moins chers sur chaque drive. */
  victoires: Record<string, number>;
};

/** Le même panier sur plusieurs drives : prix face à face, totaux et manques. */
export function comparerDrives(commande: Commande): ComparaisonDrives {
  const drives = commande.drives;
  const groupes: LigneCommande[][] = [];
  for (const l of commande.lignes) {
    // Une même ligne de liste se compare d'un drive à l'autre, quel que soit le produit retenu.
    const g = groupes.find(g => g.some(x => x.article && l.article ? x.article === l.article : memeProduit(x, l) || plat(x.libelle).toLowerCase() === plat(l.libelle).toLowerCase()));
    if (g) g.push(l); else groupes.push([l]);
  }
  const communs: FaceAFace[] = [], seulement: Record<string, LigneCommande[]> = {};
  const totaux: Record<string, number> = Object.fromEntries(drives.map(d => [d, 0]));
  const victoires: Record<string, number> = Object.fromEntries(drives.map(d => [d, 0]));
  for (const g of groupes) {
    const presents = drives.filter(d => g.some(l => l.drive === d && l.prix != null));
    if (presents.length === drives.length && drives.length > 1) {
      const prix = Object.fromEntries(drives.map(d => [d, g.find(l => l.drive === d && l.prix != null)!.prix!]));
      const tries = [...drives].sort((a, b) => prix[a] - prix[b]);
      const egal = prix[tries[0]] === prix[tries[1]];
      if (!egal) victoires[tries[0]]++;
      drives.forEach(d => { totaux[d] = arrondi(totaux[d] + prix[d]); });
      const libelles = Object.fromEntries(drives.map(d => [d, g.find(l => l.drive === d)!.libelle]));
      communs.push({ libelle: g[0].libelle, libelles, prix, moinsCher: egal ? null : tries[0], ecart: arrondi(prix[tries[1]] - prix[tries[0]]) });
    } else {
      const ici = [...new Set(g.map(l => l.drive))];
      if (ici.length === 1 && drives.length > 1) (seulement[ici[0]] ??= []).push(g[0]);
    }
  }
  const classes = [...drives].sort((a, b) => totaux[a] - totaux[b]);
  const economie = classes.length > 1 ? arrondi(totaux[classes[1]] - totaux[classes[0]]) : 0;
  return {
    drives, communs: communs.sort((a, b) => b.ecart - a.ecart), totaux,
    moinsCher: communs.length && economie > 0 ? classes[0] : null, economie, seulement, victoires,
  };
}
