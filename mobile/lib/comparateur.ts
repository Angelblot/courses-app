/**
 * Comparatif des alternatives vues sur les drives, et pistes tirées des
 * achats passés. Les offres viennent du relevé de l'extension (table
 * offres_drive) ; rien ici ne parle à Supabase.
 */

export type Drive = 'carrefour' | 'leclerc';
export type Offre = {
 drive: Drive; product_id: string | null; recherche: string; libelle: string; marque?: string | null;
 ean13: string | null; url?: string | null; image_url?: string | null;
 prix: number | null; prix_unitaire: number | null; unite_prix: 'kg' | 'l' | 'unite' | null;
 grammage_g?: number | null; volume_ml?: number | null; nutriscore: 'a' | 'b' | 'c' | 'd' | 'e' | null;
 promotion?: string | null; disponible: boolean; choisi: boolean; vu_le: string;
};
export type Achat = { product_id: string; quantite: number; le: string };
export type ProduitRef = { id: string; name: string; ean13: string | null; nutriscore?: string | null };

/** Une offre comparable : la dernière vue de ce produit sur ce drive. */
export type Ligne = Offre & { cle: string; reference: boolean; ecartPrix: number | null };
export type Piste = {
 type: 'economie' | 'nutrition' | 'format';
 produit: ProduitRef; reference: Ligne; alternative: Ligne;
 /** Économie estimée sur un an, en euros, d'après la fréquence d'achat. */
 economieAn: number | null;
 /** Écart de prix au kilo ou au litre, en part (−0,18 = 18 % moins cher). */
 ecart: number | null;
 /** Combien de fois par an le produit est acheté, d'après l'historique. */
 parAn: number;
 raison: string;
};

const NOTES = ['a', 'b', 'c', 'd', 'e'];
const rangNote = (n: string | null | undefined) => (n ? NOTES.indexOf(n) : -1);
const jours = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;
const cleOffre = (o: Offre) => `${o.drive}:${o.ean13 ?? o.libelle.toLowerCase()}`;

/**
 * Les alternatives vues pour un produit de la liste, la plus récente de
 * chacune, triées par prix au kilo (ou au litre). La référence est le
 * produit lui-même (même EAN) ou, à défaut, celui que l'extension a choisi.
 */
export function comparer(offres: Offre[], produit: ProduitRef, { maxJours = 60, maintenant = new Date().toISOString() } = {}): Ligne[] {
 const recentes = offres.filter(o => o.product_id === produit.id && jours(o.vu_le, maintenant) <= maxJours);
 const parCle = new Map<string, Offre>();
 for (const o of recentes) {
  const k = cleOffre(o), deja = parCle.get(k);
  if (!deja || Date.parse(o.vu_le) > Date.parse(deja.vu_le)) parCle.set(k, o);
 }
 const lignes = [...parCle.values()];
 const ref = lignes.find(o => produit.ean13 && o.ean13 === produit.ean13) ?? lignes.find(o => o.choisi);
 const unite = ref?.unite_prix ?? lignes.find(o => o.unite_prix)?.unite_prix ?? null;
 return lignes
  .map(o => ({ ...o, cle: cleOffre(o), reference: !!ref && cleOffre(o) === cleOffre(ref),
   ecartPrix: ref?.prix_unitaire && o.prix_unitaire && o.unite_prix === ref.unite_prix ? Math.round((o.prix_unitaire / ref.prix_unitaire - 1) * 100) / 100 : null }))
  // Les unités différentes (kg contre pièce) ne se comparent pas : elles vont en fin de liste.
  .sort((a, b) => Number(b.disponible) - Number(a.disponible)
   || Number(a.unite_prix !== unite) - Number(b.unite_prix !== unite)
   || (a.prix_unitaire ?? Infinity) - (b.prix_unitaire ?? Infinity));
}

/** Combien de fois et en quelle quantité un produit est acheté, ramené à un an. */
export function frequence(achats: Achat[], productId: string, maintenant = new Date().toISOString()) {
 const siens = achats.filter(a => a.product_id === productId);
 if (!siens.length) return { fois: 0, quantite: 0, parAn: 0 };
 const plusAncien = siens.reduce((m, a) => (a.le < m ? a.le : m), siens[0].le);
 const duree = Math.max(30, jours(plusAncien, maintenant));
 const quantite = siens.reduce((t, a) => t + a.quantite, 0);
 return { fois: siens.length, quantite, parAn: Math.round((quantite * 365 / duree) * 10) / 10 };
}

/** Quantité contenue dans une offre, dans l'unité de son prix (kg, L, pièce). */
function contenu(o: Offre): number | null {
 if (o.unite_prix === 'kg' && o.grammage_g) return o.grammage_g / 1000;
 if (o.unite_prix === 'l' && o.volume_ml) return o.volume_ml / 1000;
 if (o.prix && o.prix_unitaire) return o.prix / o.prix_unitaire;
 return null;
}

/**
 * Pistes pour les produits achetés au moins deux fois : une alternative
 * nettement moins chère au kilo et pas moins bien notée, une mieux notée
 * pour un prix voisin, ou le même produit en plus grand format. Les plus
 * rentables d'abord.
 */
export function pistes(offres: Offre[], achats: Achat[], produits: ProduitRef[], { seuil = 0.1, maintenant = new Date().toISOString() } = {}): Piste[] {
 const resultat: Piste[] = [];
 for (const produit of produits) {
  const f = frequence(achats, produit.id, maintenant);
  if (f.fois < 2) continue;
  const lignes = comparer(offres, produit, { maintenant });
  const ref = lignes.find(l => l.reference);
  if (!ref?.prix_unitaire) continue;
  const notreNote = rangNote(ref.nutriscore ?? produit.nutriscore);
  const contenuRef = contenu(ref);
  const annuel = (alt: Ligne) => contenuRef && alt.prix_unitaire ? Math.round((ref.prix_unitaire! - alt.prix_unitaire) * contenuRef * f.parAn) : null;
  const candidates = lignes.filter(l => !l.reference && l.disponible && l.ecartPrix != null);
  const memeProduit = (l: Ligne) => !!ref.marque && l.marque === ref.marque && l.libelle.split(' ')[0] === ref.libelle.split(' ')[0];
  const trouvees: Piste[] = [];
  for (const alt of candidates) {
   const note = rangNote(alt.nutriscore), pasPire = notreNote < 0 || note < 0 || note <= notreNote;
   if (alt.ecartPrix! <= -seuil && pasPire) {
    const format = memeProduit(alt) && (contenu(alt) ?? 0) > (contenuRef ?? Infinity);
    trouvees.push({ type: format ? 'format' : 'economie', produit, reference: ref, alternative: alt, economieAn: annuel(alt), ecart: alt.ecartPrix, parAn: f.parAn,
     raison: format ? `Le même en plus grand : ${Math.round(-alt.ecartPrix! * 100)} % moins cher au ${ref.unite_prix === 'l' ? 'litre' : 'kilo'}`
      : `${Math.round(-alt.ecartPrix! * 100)} % moins cher au ${ref.unite_prix === 'l' ? 'litre' : ref.unite_prix === 'kg' ? 'kilo' : 'produit'}${note >= 0 && note < notreNote ? ', et mieux noté' : ''}` });
   } else if (note >= 0 && notreNote >= 0 && note < notreNote && alt.ecartPrix! <= seuil) {
    trouvees.push({ type: 'nutrition', produit, reference: ref, alternative: alt, economieAn: annuel(alt), ecart: alt.ecartPrix, parAn: f.parAn,
     raison: `Nutri-Score ${alt.nutriscore!.toUpperCase()} au lieu de ${NOTES[notreNote].toUpperCase()}, ${alt.ecartPrix! <= 0 ? 'pour moins cher' : 'pour un prix voisin'}` });
   }
  }
  // Une piste par type et par produit : la meilleure.
  for (const type of ['economie', 'format', 'nutrition'] as const) {
   const meilleure = trouvees.filter(p => p.type === type).sort((a, b) => (a.ecart ?? 0) - (b.ecart ?? 0))[0];
   if (meilleure) resultat.push(meilleure);
  }
 }
 return resultat.sort((a, b) => (b.economieAn ?? 0) - (a.economieAn ?? 0));
}

/** Achats passés, lus dans les envois au drive terminés (cart_jobs). */
export function achatsDesEnvois(envois: { status: string; created_at: string; items: unknown }[]): Achat[] {
 return envois.filter(e => e.status === 'done' && Array.isArray(e.items)).flatMap(e =>
  (e.items as { product_id?: string | null; quantity?: number }[])
   .filter(i => typeof i?.product_id === 'string')
   .map(i => ({ product_id: i.product_id as string, quantite: Math.max(1, Number(i.quantity) || 1), le: e.created_at })));
}

/** Un point du nuage prix et Nutri-Score : colonne de la note, hauteur du prix (0 en bas, 1 en haut). */
export type Point = { ligne: Ligne; colonne: number; hauteur: number };

/**
 * Place les offres comparables à la référence (même unité de prix) : une
 * colonne par Nutri-Score, A à E, puis « ? » quand il manque ; la hauteur
 * suit le prix au kilo entre des repères ronds.
 */
export function nuage(lignes: Ligne[]) {
 const ref = lignes.find(l => l.reference);
 const unite = ref?.unite_prix ?? lignes.find(l => l.unite_prix)?.unite_prix ?? null;
 const vus = lignes.filter(l => l.disponible && l.prix_unitaire != null && l.unite_prix === unite);
 if (!vus.length) return { points: [] as Point[], reperes: [] as number[], unite };
 const prix = vus.map(l => l.prix_unitaire!);
 const pas = [0.5, 1, 2, 5, 10, 20, 50].find(p => (Math.max(...prix) - Math.min(...prix)) / p <= 4) ?? 100;
 const bas = Math.floor(Math.min(...prix) / pas) * pas, haut = Math.max(bas + pas, Math.ceil(Math.max(...prix) / pas) * pas);
 const reperes: number[] = [];
 for (let v = bas; v <= haut + 1e-9; v += pas) reperes.push(Math.round(v * 100) / 100);
 const points = vus.map(l => ({ ligne: l, colonne: l.nutriscore ? NOTES.indexOf(l.nutriscore) : 5, hauteur: (l.prix_unitaire! - bas) / (haut - bas) }));
 return { points, reperes, unite };
}

/** Identifiant stable d'une piste, pour ne plus proposer celle qu'on a écartée. */
export const clePiste = (p: Piste) => `${p.produit.id}:${p.alternative.cle}`;

/** « une fois par mois », « chaque semaine »… d'après le nombre d'achats par an. */
export function rythme(parAn: number): string {
 if (parAn >= 40) return 'chaque semaine';
 if (parAn >= 18) return 'deux fois par mois';
 if (parAn >= 9) return 'environ une fois par mois';
 if (parAn >= 4) return 'tous les deux ou trois mois';
 return 'de temps en temps';
}
