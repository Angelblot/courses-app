/**
 * Organisation du catalogue : filtre, tri, regroupement.
 *
 * Fonction pure, sans accès au réseau : c'est la règle qu'on veut pouvoir
 * éprouver, et elle n'a pas besoin de Supabase pour cela.
 */
import { filtrerCatalogue } from './recettes-affichage.ts';
import { RAYONS, rayonDepuisLibelle, libelleRayon, type CleRayon } from './rayons.ts';

export type CleTri = 'rayon' | 'nom' | 'favoris';

/** Tris proposés, dans l'ordre où ils s'affichent. */
export const TRIS: ReadonlyArray<{ cle: CleTri; label: string }> = [
  { cle: 'rayon', label: 'Par rayon' },
  { cle: 'nom', label: 'Par nom' },
  { cle: 'favoris', label: 'Favoris' },
];

export type SectionCatalogue<T> = {
  /** `null` quand il n'y a qu'une section : rien à titrer. */
  titre: string | null;
  produits: T[];
};

type Produit = { name: string; category?: string | null; favorite?: boolean; brand?: string | null };

/**
 * Comparaison de noms indifférente aux accents et à la casse.
 *
 * Sans elle, « Œufs » et « Éclair » se retrouvent après « Zeste » : leurs
 * codes de caractère sont plus grands que ceux des lettres latines.
 */
const parNom = (a: Produit, b: Produit) =>
  a.name.localeCompare(b.name, 'fr', { sensitivity: 'base', numeric: true });

export function organiserCatalogue<T extends Produit>(
  produits: T[],
  requete: string,
  tri: CleTri,
): Array<SectionCatalogue<T>> {
  const retenus = filtrerCatalogue(produits, requete);
  if (retenus.length === 0) return [];

  if (tri === 'nom') {
    return [{ titre: null, produits: [...retenus].sort(parNom) }];
  }

  if (tri === 'favoris') {
    const favoris = retenus.filter((p) => p.favorite).sort(parNom);
    const reste = retenus.filter((p) => !p.favorite).sort(parNom);
    // Une section vide afficherait un titre sous lequel il n'y a rien.
    return [
      ...(favoris.length ? [{ titre: 'Favoris', produits: favoris }] : []),
      ...(reste.length ? [{ titre: 'Le reste', produits: reste }] : []),
    ];
  }

  // Par rayon : l'ordre est celui du magasin, pas l'alphabet — la liste sert
  // à faire les courses, et on ne revient pas sur ses pas.
  const parRayon = new Map<CleRayon, T[]>();
  for (const p of retenus) {
    const cle = rayonDepuisLibelle(p.category ?? null);
    const groupe = parRayon.get(cle);
    if (groupe) groupe.push(p);
    else parRayon.set(cle, [p]);
  }
  return RAYONS
    .filter(({ cle }) => parRayon.has(cle))
    .map(({ cle }) => ({
      titre: libelleRayon(cle),
      produits: parRayon.get(cle)!.sort(parNom),
    }));
}
