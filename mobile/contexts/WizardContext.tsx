import {
  createContext, useCallback, useContext, useMemo, useState, type ReactNode,
} from 'react';
import type { CleRayon } from '../lib/rayons.ts';

export const ETAPES = [
  { cle: 'recettes', titre: 'Choisis tes recettes' },
  { cle: 'quotidien', titre: 'Ton quotidien' },
  { cle: 'ingredients', titre: 'Ingrédients de tes recettes' },
  { cle: 'recap', titre: 'Récap de ta liste' },
  { cle: 'generation', titre: 'Lance la génération' },
] as const;

export type CleEtape = (typeof ETAPES)[number]['cle'];

export type LigneExtra = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  rayon: CleRayon;
};

type Etat = {
  selectedRecipes: Record<string, number>;
  quotidien: Record<string, 'needed' | 'have'>;
  quotidienQty: Record<string, number>;
  extras: LigneExtra[];
  /** Produit retenu par groupe d'ingrédients, à l'étape 3. */
  choixProduits: Record<string, string>;
  drives: string[];
};

const INITIAL: Etat = {
  selectedRecipes: {},
  quotidien: {},
  quotidienQty: {},
  extras: [],
  choixProduits: {},
  drives: ['carrefour', 'leclerc'],
};

type Contexte = Etat & {
  toggleRecette: (id: string, partsParDefaut: number) => void;
  setParts: (id: string, n: number) => void;
  marquerProduit: (id: string, statut: 'needed' | 'have' | null) => void;
  setQuantite: (id: string, n: number) => void;
  ajouterExtra: (e: Omit<LigneExtra, 'id'>) => void;
  retirerExtra: (id: string) => void;
  choisirProduit: (cleGroupe: string, produitId: string) => void;
  basculerDrive: (nom: string) => void;
  reinitialiser: () => void;
};

const WizardCtx = createContext<Contexte | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<Etat>(INITIAL);
  // Compteur monotone pour les identifiants d'ajouts manuels : `Date.now()`
  // seul peut se répéter si deux ajouts tombent dans la même milliseconde.
  const [compteur, setCompteur] = useState(0);

  const toggleRecette = useCallback((id: string, partsParDefaut: number) => {
    setEtat((e) => {
      const suite = { ...e.selectedRecipes };
      if (suite[id] != null) delete suite[id];
      else suite[id] = partsParDefaut || 2;
      return { ...e, selectedRecipes: suite };
    });
  }, []);

  const setParts = useCallback((id: string, n: number) => {
    setEtat((e) => ({
      ...e,
      selectedRecipes: { ...e.selectedRecipes, [id]: Math.max(1, Math.round(n) || 1) },
    }));
  }, []);

  const marquerProduit = useCallback((id: string, statut: 'needed' | 'have' | null) => {
    setEtat((e) => {
      const suite = { ...e.quotidien };
      if (statut == null || suite[id] === statut) delete suite[id];
      else suite[id] = statut;
      return { ...e, quotidien: suite };
    });
  }, []);

  const setQuantite = useCallback((id: string, n: number) => {
    setEtat((e) => ({
      ...e,
      quotidienQty: { ...e.quotidienQty, [id]: Math.max(0, Math.round(n) || 0) },
    }));
  }, []);

  const ajouterExtra = useCallback((extra: Omit<LigneExtra, 'id'>) => {
    setCompteur((c) => c + 1);
    setEtat((e) => ({
      ...e,
      extras: [...e.extras, { ...extra, id: `extra-${e.extras.length}-${compteur}` }],
    }));
  }, [compteur]);

  const retirerExtra = useCallback((id: string) => {
    setEtat((e) => ({ ...e, extras: e.extras.filter((x) => x.id !== id) }));
  }, []);

  const choisirProduit = useCallback((cleGroupe: string, produitId: string) => {
    setEtat((e) => ({ ...e, choixProduits: { ...e.choixProduits, [cleGroupe]: produitId } }));
  }, []);

  const basculerDrive = useCallback((nom: string) => {
    setEtat((e) => ({
      ...e,
      drives: e.drives.includes(nom) ? e.drives.filter((d) => d !== nom) : [...e.drives, nom],
    }));
  }, []);

  const reinitialiser = useCallback(() => setEtat(INITIAL), []);

  const valeur = useMemo<Contexte>(() => ({
    ...etat,
    toggleRecette, setParts, marquerProduit, setQuantite,
    ajouterExtra, retirerExtra, choisirProduit, basculerDrive, reinitialiser,
  }), [
    etat, toggleRecette, setParts, marquerProduit, setQuantite,
    ajouterExtra, retirerExtra, choisirProduit, basculerDrive, reinitialiser,
  ]);

  return <WizardCtx.Provider value={valeur}>{children}</WizardCtx.Provider>;
}

export function useWizard(): Contexte {
  const ctx = useContext(WizardCtx);
  if (!ctx) throw new Error('useWizard doit être appelé sous <WizardProvider>');
  return ctx;
}
