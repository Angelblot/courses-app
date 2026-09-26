/**
 * Analyse d'une recette importée depuis un site de cuisine.
 *
 * Aucun import de Supabase ni de React Native : ces fonctions doivent rester
 * exécutables sous `node --test`. C'est toute la raison pour laquelle la
 * fonction Edge ne fait que récupérer la page — elle ne l'interprète pas.
 */

export type LigneAnalysee = {
  quantite: number;
  unite: string;
  nom: string;
  /** Vrai quand la ligne ne portait aucune quantité : « sel », « poivre ». */
  aVerifier: boolean;
};

export type RecetteImportee = {
  nom: string;
  parts: number;
  image: string | null;
  ingredients: string[];
  /** Minutes, ou `null` si la page ne le publie pas. */
  preparationMin: number | null;
  cuissonMin: number | null;
  kcalParPart: number | null;
};

/**
 * Unités reconnues, de la plus longue à la plus courte.
 *
 * L'ordre compte : sans lui, « cuillère » l'emporterait sur « cuillère à
 * soupe » et laisserait « à soupe » dans le nom de l'ingrédient.
 */
const UNITES_CONNUES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^cuill[eè]res?\s+[àa]\s+soupe\b/i, 'cuillère à soupe'],
  [/^cuill[eè]res?\s+[àa]\s+caf[ée]\b/i, 'cuillère à café'],

  // Abréviations françaises, relevées sur des recettes Jow le 24/08. Elles ne
  // sont jamais suivies de « de », donc la règle générale plus bas les
  // laissait filer dans le nom : « 2 unités de càs Sauce soja ».
  //
  // La sentinelle `(?=[\s(]|$)` remplace `\b`, sans effet après un point. Elle
  // exige la fin du mot, ce qui empêche « bou. » de mordre sur « bouteille ».
  [/^c\.?\s*[àa]\.?\s*s\.?(?=[\s(]|$)/i, 'cuillère à soupe'],
  [/^c\.?\s*[àa]\.?\s*c\.?(?=[\s(]|$)/i, 'cuillère à café'],
  [/^tran\.(?=[\s(]|$)/i, 'tranche'],
  [/^gou\.(?=[\s(]|$)/i, 'gousse'],
  [/^pinc\.(?=[\s(]|$)/i, 'pincée'],
  [/^bou\.(?=[\s(]|$)/i, 'bouquet'],
  [/^brins?(?=[\s(]|$)/i, 'brin'],
  [/^poign[ée]es?(?=[\s(]|$)/i, 'poignée'],
  [/^quartiers?(?=[\s(]|$)/i, 'quartier'],
  [/^feuilles?(?=[\s(]|$)/i, 'feuille'],
  [/^kilogrammes?\b/i, 'kg'], [/^kg\b/i, 'kg'],
  [/^grammes?\b/i, 'g'], [/^gr?\b/i, 'g'],
  [/^millilitres?\b/i, 'ml'], [/^ml\b/i, 'ml'],
  [/^centilitres?\b/i, 'cl'], [/^cl\b/i, 'cl'],
  [/^litres?\b/i, 'L'], [/^l\b/i, 'L'],
  [/^pinc[ée]es?\b/i, 'pincée'],
  [/^gousses?\b/i, 'gousse'],
  [/^tranches?\b/i, 'tranche'],
  [/^sachets?\b/i, 'sachet'],
  [/^branches?\b/i, 'branche'],
  [/^bo[iî]tes?\b/i, 'boîte'],
  [/^paquets?\b/i, 'paquet'],
];

/** Article ou élision ouvrant un nom : « de », « de la », « du », « d' ». */
const ARTICLE = /^(?:d['’]|de\s+la\s+|de\s+l['’]|des\s+|du\s+|de\s+)/i;

// Le `trim()` d'entrée n'est pas décoratif : le découpage laisse l'espace qui
// suivait l'unité, et le motif est ancré au début.
const sansArticle = (s: string) => s.trim().replace(ARTICLE, '').trim();

/**
 * Découpe une ligne d'ingrédient en quantité, unité et nom.
 *
 * Une ligne sans quantité rend 0 et se signale : « sel » n'est pas « 1 unité
 * de sel », et inventer une quantité la ferait remonter telle quelle jusqu'au
 * panier.
 */
export function analyserLigne(ligne: string): LigneAnalysee {
  const brut = (ligne ?? '').replace(/\s+/g, ' ').trim();
  if (!brut) return { quantite: 0, unite: 'unité', nom: '', aVerifier: true };

  const m = brut.match(/^(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return { quantite: 0, unite: 'unité', nom: brut, aVerifier: true };

  const texteQuantite = m[1];
  const reste = m[2].trim();

  let quantite: number;
  if (texteQuantite.includes('/')) {
    const [a, b] = texteQuantite.split('/').map((x) => Number(x.trim()));
    quantite = b ? a / b : 0;
  } else {
    quantite = Number(texteQuantite.replace(',', '.'));
  }

  for (const [motif, unite] of UNITES_CONNUES) {
    const trouve = reste.match(motif);
    if (trouve) {
      return { quantite, unite, nom: sansArticle(reste.slice(trouve[0].length)), aVerifier: false };
    }
  }

  // Une unité inconnue n'est retenue que si elle précède un « de » : sans
  // cette règle, « 4 oignons » ferait de « oignons » une unité et laisserait
  // un nom vide.
  const avecDe = reste.match(
    /^(\S+)\s+(?:d['’]|de\s+la\s+|de\s+l['’]|des\s+|du\s+|de\s+)(.+)$/i,
  );
  if (avecDe) {
    return { quantite, unite: avecDe[1].toLowerCase(), nom: avecDe[2].trim(), aVerifier: false };
  }

  return { quantite, unite: 'unité', nom: sansArticle(reste), aVerifier: false };
}

/**
 * Nombre de parts, quelle que soit la forme rendue par le site.
 *
 * `recipeYield` vaut souvent `"4 personnes"`, parfois un nombre, parfois un
 * tableau. À défaut on rend 4 : inventer 1 ferait des quantités quatre fois
 * trop petites sans que rien ne le signale.
 */
export function lireParts(brut: unknown): number {
  const valeur = Array.isArray(brut) ? brut[0] : brut;
  if (typeof valeur === 'number' && Number.isFinite(valeur) && valeur > 0) {
    return Math.round(valeur);
  }
  const n = String(valeur ?? '').match(/\d+/);
  const parts = n ? Number(n[0]) : 0;
  return parts > 0 ? parts : 4;
}

/**
 * Durée ISO 8601 en minutes : « PT18M » vaut 18, « PT1H30M » vaut 90.
 *
 * Zéro est une donnée et non une absence — « PT0M » en cuisson signifie qu'il
 * n'y a pas de cuisson, ce que l'écran choisira de taire. Le confondre avec
 * l'inconnu effacerait une information.
 */
export function lireDuree(brut: unknown): number | null {
  const m = String(brut ?? '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
  if (!m || (!m[1] && !m[2])) return null;
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
}

/**
 * Calories par portion. Jow écrit « 754 kcal », Marmiton « 667 calories ».
 *
 * Zéro est rejeté ici, à l'inverse des durées : une recette sans aucune
 * calorie n'existe pas, c'est donc une valeur manquante mal encodée.
 */
export function lireCalories(nutrition: unknown): number | null {
  const brut = (nutrition as { calories?: unknown } | null)?.calories;
  if (typeof brut === 'number') return Number.isFinite(brut) && brut > 0 ? Math.round(brut) : null;
  const m = String(brut ?? '').match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = Math.round(Number(m[1].replace(',', '.')));
  return n > 0 ? n : null;
}

/** Première adresse d'image, que le site la rende en chaîne, objet ou tableau. */
function lireImage(brut: unknown): string | null {
  const valeur = Array.isArray(brut) ? brut[0] : brut;
  if (typeof valeur === 'string') return valeur || null;
  if (valeur && typeof valeur === 'object') {
    const url = (valeur as { url?: unknown }).url;
    return typeof url === 'string' ? url : null;
  }
  return null;
}

const estRecette = (n: unknown): boolean => {
  const t = (n as { '@type'?: unknown })?.['@type'];
  return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
};

/**
 * Trouve la recette parmi les blocs `application/ld+json` d'une page.
 *
 * Les sites l'enveloppent de trois façons : un objet seul, un tableau, ou un
 * `@graph`. Un bloc illisible est ignoré plutôt que fatal — une page en porte
 * souvent plusieurs, et un seul cassé ne doit pas condamner l'import.
 */
export function extraireRecette(blocs: string[]): RecetteImportee | null {
  for (const bloc of blocs ?? []) {
    let racine: unknown;
    try {
      racine = JSON.parse(bloc);
    } catch {
      continue;
    }
    const candidats: unknown[] = Array.isArray(racine)
      ? racine
      : (racine as { '@graph'?: unknown[] })?.['@graph'] ?? [racine];

    for (const n of candidats) {
      if (!estRecette(n)) continue;
      const r = n as Record<string, unknown>;
      const ingredients = (r.recipeIngredient as unknown[] | undefined) ?? [];
      return {
        nom: String(r.name ?? '').trim(),
        parts: lireParts(r.recipeYield),
        image: lireImage(r.image),
        ingredients: ingredients.map((x) => String(x)).filter((x) => x.trim()),
        preparationMin: lireDuree(r.prepTime),
        cuissonMin: lireDuree(r.cookTime),
        kcalParPart: lireCalories(r.nutrition),
      };
    }
  }
  return null;
}
