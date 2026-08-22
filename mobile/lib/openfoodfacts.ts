/**
 * Client Open Food Facts pour le scan.
 *
 * Le mapping est porté de backend/app/services/enrich_ean.py (retiré le
 * 22/08/2026, dans l'historique git) : détection des
 * liquides et affectation de la quantité en grammes ou en millilitres.
 */
import { normalizeProductType } from './typology.ts';
import { rayonDepuisCategories, type CleRayon } from './rayons.ts';

export type NoteNutri = 'a' | 'b' | 'c' | 'd' | 'e';

export type FicheProduit = {
  ean13: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  grammageG: number | null;
  volumeMl: number | null;
  productType: string | null;
  /** Rayon déduit des catégories Open Food Facts, corrigeable par l'utilisateur. */
  categoryKey: CleRayon | null;
  /** Note Open Food Facts. `null` est fréquent et légitime : sel, café, épices. */
  nutriscore: NoteNutri | null;
};

type OffData = {
  product_name?: string;
  brands?: string;
  image_url?: string;
  product_quantity?: number | string;
  categories_tags?: string[];
  nutriscore_grade?: string;
};

const MOTS_LIQUIDES = [
  'lait', 'huile', 'creme', 'jus', 'soda', 'biere', 'vin', 'sauce', 'sirop',
  'boisson', 'limonade', 'yaourt', 'eau', 'nectar', 'smoothie', 'tonic',
];

const CATEGORIES_LIQUIDES = ['beverages', 'drinks', 'waters', 'juices', 'milks'];

// Plage Unicode "Combining Diacritical Marks" en points de code plutot
// qu'en caracteres litteraux invisibles : voir la meme fonction dans
// `typology.ts` pour la justification complete.
const sansAccents = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '');

// Échappe les métacaractères regex d'un mot-clé avant de l'insérer dans un
// `new RegExp(...)`. `typology.ts` a la même fonction, non exportée : c'est
// une utilitaire pure d'une ligne, sans état, et les deux modules raisonnent
// sur des tables de mots-clés indépendantes (typologie des produits ici,
// détection de liquide là-bas). Créer un couplage entre ces deux modules
// pour partager une ligne de regex serait plus coûteux que de la dupliquer —
// aucun des deux n'a de raison de dépendre de l'autre pour évoluer.
// Exportée uniquement pour être testée directement : la liste MOTS_LIQUIDES
// actuelle ne contient aucun métacaractère, donc estLiquide() seul ne peut
// pas démontrer que l'échappement fonctionne.
export const echappe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Un produit est liquide si son nom ou sa catégorie Open Food Facts le dit. */
export function estLiquide(nom: string, categories: string[] = []): boolean {
  const n = sansAccents(nom);
  if (MOTS_LIQUIDES.some((m) => new RegExp(`(^|\\s)${echappe(m)}`).test(n))) return true;
  return categories.some((c) => CATEGORIES_LIQUIDES.some((l) => c.includes(l)));
}

/**
 * Lit la note Nutriscore d'Open Food Facts.
 *
 * L'API renvoie aussi « unknown » et « not-applicable » pour les produits non
 * notés : les deux valent `null`, pas une note.
 */
function litNutriscore(brut: string | undefined): NoteNutri | null {
  const n = (brut ?? '').trim().toLowerCase();
  return ['a', 'b', 'c', 'd', 'e'].includes(n) ? (n as NoteNutri) : null;
}

/**
 * Convertit une réponse Open Food Facts en fiche exploitable.
 *
 * @returns null si la fiche n'a pas de nom — un produit sans libellé serait
 *   inutilisable dans le catalogue, mieux vaut basculer sur la saisie manuelle.
 */
export function mapOffProduct(ean: string, data: OffData): FicheProduit | null {
  const name = (data.product_name ?? '').trim();
  if (!name) return null;

  const quantite = Number(data.product_quantity);
  const valide = Number.isFinite(quantite) && quantite > 0;
  const categories = data.categories_tags ?? [];
  const liquide = estLiquide(name, categories);

  return {
    ean13: ean,
    name,
    // Open Food Facts liste parfois plusieurs marques séparées par des
    // virgules, parfois avec une virgule de tête vide (ex. ", Danone") :
    // on retient la première valeur non vide plutôt que le premier élément.
    brand: (data.brands ?? '').split(',').map((m) => m.trim()).find((m) => m) ?? null,
    imageUrl: data.image_url || null,
    grammageG: valide && !liquide ? Math.round(quantite) : null,
    volumeMl: valide && liquide ? Math.round(quantite) : null,
    productType: normalizeProductType(name, categories),
    categoryKey: rayonDepuisCategories(categories),
    nutriscore: litNutriscore(data.nutriscore_grade),
  };
}

const URL_OFF = 'https://world.openfoodfacts.org/api/v2/product';
const CHAMPS = 'product_name,brands,image_url,product_quantity,categories_tags,nutriscore_grade';

// Délai avant d'abandonner la requête. La source Python (enrich_ean.py) pose
// 10 secondes, mais elle tourne côté serveur pour un traitement par lot :
// ici l'utilisateur a le doigt sur le déclencheur de scan et regarde son
// écran. 5 secondes est déjà long à vivre devant une caméra ; au-delà, mieux
// vaut rendre la main (mode hors ligne) que de laisser l'écran figé.
const DELAI_MS = 5000;

/**
 * Trois issues possibles pour une recherche de code-barres, et pas un simple
 * booléen "trouvé / pas trouvé" : l'écran de scan doit réagir différemment
 * selon la cause de l'échec.
 * - `trouve`   : la fiche est exploitable, on l'ajoute au panier.
 * - `inconnu`  : Open Food Facts a répondu, ce code-barres ne lui dit rien
 *   (ou la fiche renvoyée est inexploitable, ex. sans nom). C'est un fait
 *   stable : rejouer la requête ne changera rien tant que personne n'a
 *   complété la base. La bonne réponse est la saisie manuelle immédiate.
 * - `hors_ligne` : on n'a pas pu interroger Open Food Facts (panne réseau,
 *   DNS, délai dépassé). Le produit existe peut-être très bien : c'est le
 *   réseau qui a manqué, pas la base. La bonne réponse est de mettre le scan
 *   en file d'attente et de réessayer au retour de la connexion — surtout
 *   pas d'obliger l'utilisateur à ressaisir un produit que l'app connaît.
 * Un booléen unique confondrait ces deux cas et forcerait l'un des deux
 * parcours à s'appliquer à tort à l'autre situation.
 */
export type ResultatRecherche =
  | { etat: 'trouve'; fiche: FicheProduit }
  | { etat: 'inconnu' }
  | { etat: 'hors_ligne' };

/** Interroge Open Food Facts pour un code-barres. Voir `ResultatRecherche`. */
export async function lookupEan(ean: string): Promise<ResultatRecherche> {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    const reponse = await fetch(`${URL_OFF}/${ean}.json?fields=${CHAMPS}`, {
      headers: { 'User-Agent': 'courses-app/1.0 (usage familial)' },
      signal: controleur.signal,
    });
    // Une réponse HTTP en erreur (5xx, proxy, etc.) est un problème de
    // service, pas un verdict sur le produit : Open Food Facts signale un
    // code-barres inconnu via `status` dans un corps 200, pas par un code
    // HTTP d'erreur. On la traite donc comme `hors_ligne`.
    if (!reponse.ok) return { etat: 'hors_ligne' };
    const json = await reponse.json();
    if (json.status !== 1 || !json.product) return { etat: 'inconnu' };
    const fiche = mapOffProduct(ean, json.product);
    return fiche ? { etat: 'trouve', fiche } : { etat: 'inconnu' };
  } catch {
    // Fetch échoue de la même façon (TypeError) pour une coupure réseau que
    // pour notre propre abandon sur délai dépassé : dans les deux cas, on
    // n'a pas eu de réponse d'Open Food Facts, donc `hors_ligne`.
    return { etat: 'hors_ligne' };
  } finally {
    clearTimeout(minuteur);
  }
}

/**
 * Convertit une réponse de recherche en fiches exploitables.
 *
 * Séparée de l'appel réseau pour être testable : c'est la partie où une
 * réponse inattendue ferait le plus de dégâts.
 */
export function analyserRechercheNom(json: unknown): FicheProduit[] {
  const produits = (json as { products?: unknown })?.products;
  if (!Array.isArray(produits)) return [];
  return produits
    .map((p: OffData & { code?: string }) => mapOffProduct(p?.code ?? '', p ?? {}))
    .filter((f): f is FicheProduit => f !== null);
}

export type ResultatRechercheNom =
  | { etat: 'trouve'; fiches: FicheProduit[] }
  | { etat: 'vide' }
  | { etat: 'indisponible' };

/** Nombre de résultats demandés : au-delà, la liste devient illisible au pouce. */
const TAILLE_PAGE = 12;

/**
 * Cherche des produits par nom dans Open Food Facts.
 *
 * On emploie `cgi/search.pl` et non `/api/v2/search` : cette dernière répondait
 * `503` le 22/08/2026 — « Page temporarily unavailable ». L'ancienne route
 * fonctionne et rend les mêmes champs.
 *
 * L'indisponibilité est un état ordinaire, pas une erreur : Open Food Facts est
 * un service gratuit, et le catalogue local reste utilisable sans lui.
 */
export async function rechercherParNom(requete: string): Promise<ResultatRechercheNom> {
  const q = requete.trim();
  if (q.length < 3) return { etat: 'vide' };

  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    const url = 'https://world.openfoodfacts.org/cgi/search.pl'
      + `?search_terms=${encodeURIComponent(q)}`
      + '&search_simple=1&action=process&json=1'
      + `&page_size=${TAILLE_PAGE}`
      + `&fields=${CHAMPS},code`;
    const reponse = await fetch(url, {
      headers: { 'User-Agent': 'courses-app/1.0 (usage familial)' },
      signal: controleur.signal,
    });
    if (!reponse.ok) return { etat: 'indisponible' };
    const fiches = analyserRechercheNom(await reponse.json());
    return fiches.length ? { etat: 'trouve', fiches } : { etat: 'vide' };
  } catch {
    return { etat: 'indisponible' };
  } finally {
    clearTimeout(minuteur);
  }
}
