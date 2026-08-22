/**
 * Calculs d'affichage des recettes : mise à l'échelle, aplat de couleur,
 * filtrage du catalogue.
 *
 * Aucun import de React ni de Supabase : ces fonctions doivent rester
 * exécutables sous `node --test`.
 */

/** Nombre de teintes dans `colors.aplats`. */
const NB_APLATS = 6;

/**
 * Quantité d'un ingrédient pour un nombre de parts donné.
 *
 * Un nombre de parts nul ou négatif rend 0 : mieux vaut n'afficher aucune
 * quantité qu'une quantité négative, qui remonterait telle quelle jusqu'au
 * panier.
 */
export function quantitePourParts(quantiteParPart: number, parts: number): number {
  if (!Number.isFinite(quantiteParPart) || !Number.isFinite(parts)) return 0;
  if (parts <= 0) return 0;
  return quantiteParPart * parts;
}

/** Première lettre du nom, en majuscule. `?` si le nom est vide. */
export function initiale(nom: string): string {
  const n = (nom ?? '').trim();
  return n.length > 0 ? n[0].toLocaleUpperCase('fr-FR') : '?';
}

/**
 * Indice de teinte pour une recette sans photo.
 *
 * Dérivé du nom plutôt que stocké : la même recette garde la même couleur d'un
 * affichage à l'autre, sans colonne supplémentaire ni migration.
 */
export function indiceAplat(nom: string): number {
  let somme = 0;
  for (const c of nom ?? '') somme = (somme + c.codePointAt(0)!) % 100_000;
  return somme % NB_APLATS;
}

const sansAccents = (s: string) =>
  (s ?? '').toLowerCase().normalize('NFD')
    // Points de code plutôt que caractères littéraux : ces marques sont
    // invisibles dans un éditeur et se perdent au copier-coller.
    .replace(/[\u0300-\u036F]/g, '');

/**
 * Filtre le catalogue sur le nom et la marque.
 *
 * Tous les mots de la requête doivent apparaître, dans n'importe quel ordre :
 * « fraiche epaisse » trouve « Crème Fraîche Épaisse », ce qu'une recherche de
 * sous-chaîne exacte manquerait.
 */
export function filtrerCatalogue<T extends { name: string; brand?: string | null }>(
  produits: T[],
  requete: string,
): T[] {
  const mots = sansAccents(requete).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return produits;
  return produits.filter((p) => {
    const foin = sansAccents(`${p.name} ${p.brand ?? ''}`);
    return mots.every((m) => foin.includes(m));
  });
}
