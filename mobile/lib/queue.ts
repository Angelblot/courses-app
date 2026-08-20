/**
 * File d'attente des scans effectués hors connexion.
 *
 * Le stockage est injecté plutôt qu'importé, ce qui rend la file testable
 * sans React Native.
 */
import type { FicheProduit } from './openfoodfacts.ts';

const CLE = 'courses.file_scan';

type Stockage = {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
  removeItem: (k: string) => Promise<void>;
};

export function creerFile(stockage: Stockage) {
  const lire = async (): Promise<FicheProduit[]> => {
    const brut = await stockage.getItem(CLE);
    if (!brut) return [];
    try {
      const v = JSON.parse(brut);
      return Array.isArray(v) ? v : [];
    } catch {
      // Un stockage corrompu ne doit pas bloquer l'application au démarrage.
      return [];
    }
  };

  return {
    async enfiler(fiche: FicheProduit) {
      const file = await lire();
      // Tenir le même produit devant l'objectif ne doit pas le empiler.
      if (file.some((f) => f.ean13 === fiche.ean13)) return;
      await stockage.setItem(CLE, JSON.stringify([...file, fiche]));
    },
    /** Lit sans vider : la file n'est purgée qu'après envoi confirmé. */
    defiler: lire,
    async viderFile() {
      await stockage.removeItem(CLE);
    },
    async taille() {
      return (await lire()).length;
    },
  };
}
