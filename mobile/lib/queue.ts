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
    /**
     * Remplace tout le contenu de la file par `fiches`, en une seule
     * écriture. À utiliser à la place de `viderFile` suivi de plusieurs
     * `enfiler` pour retirer les fiches envoyées avec succès : cette
     * dernière séquence vide la file en mémoire persistée, y compris les
     * fiches pas encore renvoyées, avant de les réinsérer une par une —
     * si l'application est tuée entre les deux, tout ce qui n'a pas encore
     * été ré-enfilé est perdu, alors que ces fiches n'ont jamais été
     * envoyées avec succès. `remplacer` n'a qu'un seul `setItem` : il n'y a
     * pas d'état intermédiaire où la file serait vide.
     */
    async remplacer(fiches: FicheProduit[]) {
      await stockage.setItem(CLE, JSON.stringify(fiches));
    },
    async taille() {
      return (await lire()).length;
    },
  };
}
