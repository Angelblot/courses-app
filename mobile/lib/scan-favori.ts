import type { FicheProduit } from './openfoodfacts.ts';

type Resultat = { ok: boolean; reseau?: boolean; erreur?: string };
type Existant = { id: string; favorite: boolean };

/** Un nouveau scan peut remettre un produit existant en favori, sans écraser sa fiche. */
export async function enregistrerScanFavori(
  fiche: FicheProduit,
  ajouter: (fiche: FicheProduit) => Promise<Resultat & { doublon?: Existant }>,
  favoriser: (id: string, favori: boolean) => Promise<Resultat>,
): Promise<Resultat> {
  const resultat = await ajouter(fiche);
  if (!resultat.doublon) return resultat;
  if (resultat.doublon.favorite) return { ok: true };
  return favoriser(resultat.doublon.id, true);
}
