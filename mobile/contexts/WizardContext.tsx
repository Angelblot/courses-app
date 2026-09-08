import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View, Text } from 'react-native';
import {
  createContext, useCallback, useContext, useMemo, useState, useEffect, useRef, type ReactNode,
} from 'react';
import type { CleRayon } from '../lib/rayons.ts';

export const ETAPES = [
  { cle: 'recettes', titre: 'Choisis tes recettes' },
  { cle: 'quotidien', titre: 'Ton quotidien' },
  { cle: 'ingredients', titre: 'Ingrédients de tes recettes' },
  { cle: 'recap', titre: 'Récap de ta liste' },
  { cle: 'generation', titre: 'Choisir mon drive' },
] as const;

export type CleEtape = (typeof ETAPES)[number]['cle'];

export type LigneExtra = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  rayon: CleRayon;
};

export type Etat = {
  ligneQuantites: Record<string, number>;
  lignePossedees: Record<string, boolean>;
  selectedRecipes: Record<string, number>;
  quotidien: Record<string, 'needed' | 'have'>;
  quotidienQty: Record<string, number>;
  extras: LigneExtra[];
  /** Produit retenu par groupe d'ingrédients, à l'étape 3. */
  choixProduits: Record<string, string>;
  drives: string[];
};

const INITIAL: Etat = {
  ligneQuantites: {}, lignePossedees: {},
  selectedRecipes: {},
  quotidien: {},
  quotidienQty: {},
  extras: [],
  choixProduits: {},
  drives: ['carrefour'],
};

type Contexte = Etat & {
  pret: boolean; sauvegardeErreur: string | null;
  modifierLigne: (key: string, n: number) => void;
  possederLigne: (key: string, owned: boolean) => void;
  ajouterProduitListe: (id: string) => void;
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

export function WizardProvider({ children, userId }: { children: ReactNode; userId: string | null }) {
  const [etat, setEtat] = useState<Etat>(INITIAL);
  const [pret, setPret] = useState(!userId);
  const [stockagePret, setStockagePret] = useState(false);
  const [sauvegardeErreur, setSauvegardeErreur] = useState<string | null>(null);
  const ecritures = useRef(Promise.resolve());
  const cle = `tablee-maison-v1:${userId}`;
  useEffect(() => {
    let actif = true;
    if (!userId) return;
    AsyncStorage.getItem(cle).then(brut => {
      if (!actif) return;
      if (brut) {
        const data = JSON.parse(brut);
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Brouillon invalide');
        setEtat({ ...INITIAL, ...data });
      }
      setStockagePret(true);
    }).catch(() => { if (actif) setSauvegardeErreur('Impossible de restaurer le brouillon sur cet appareil.'); })
      .finally(() => { if (actif) setPret(true); });
    return () => { actif = false; };
  }, [cle, userId]);
  useEffect(() => {
    if (!pret || !stockagePret || !userId) return;
    const contenu = JSON.stringify(etat);
    ecritures.current = ecritures.current.then(() => AsyncStorage.setItem(cle, contenu))
      .then(() => setSauvegardeErreur(null))
      .catch(() => setSauvegardeErreur('Le brouillon n’a pas pu être enregistré sur cet appareil.'));
  }, [etat, pret, stockagePret, cle, userId]);
  const modifierLigne = useCallback((key: string, n: number) => setEtat(e => ({ ...e, ligneQuantites: { ...e.ligneQuantites, [key]: Math.max(0, Math.ceil(n)) } })), []);
  const possederLigne = useCallback((key: string, owned: boolean) => setEtat(e => ({ ...e, lignePossedees: { ...e.lignePossedees, [key]: owned } })), []);
  const ajouterProduitListe = useCallback((id: string) => setEtat(e => ({ ...e,
    quotidien: { ...e.quotidien, [id]: 'needed' },
    quotidienQty: { ...e.quotidienQty, [id]: (e.quotidien[id] === 'needed' ? e.quotidienQty[id] ?? 1 : 0) + 1 },
    lignePossedees: { ...e.lignePossedees, [`produit:${id}`]: false },
    ligneQuantites: Object.fromEntries(Object.entries(e.ligneQuantites).filter(([k]) => k !== `produit:${id}`)),
  })), []);
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
      extras: [...e.extras, { ...extra, id: `extra-${Date.now()}-${compteur}-${Math.random().toString(36).slice(2,8)}` }],
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
    ...etat, pret, sauvegardeErreur, modifierLigne, possederLigne, ajouterProduitListe,
    toggleRecette, setParts, marquerProduit, setQuantite,
    ajouterExtra, retirerExtra, choisirProduit, basculerDrive, reinitialiser,
  }), [
    etat, pret, sauvegardeErreur, modifierLigne, possederLigne, ajouterProduitListe, toggleRecette, setParts, marquerProduit, setQuantite,
    ajouterExtra, retirerExtra, choisirProduit, basculerDrive, reinitialiser,
  ]);

  if (!pret) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7F2' }}><ActivityIndicator color="#48613A" /><Text>Restauration de ta liste…</Text></View>;
  return <WizardCtx.Provider value={valeur}>{children}</WizardCtx.Provider>;
}

export function useWizard(): Contexte {
  const ctx = useContext(WizardCtx);
  if (!ctx) throw new Error('useWizard doit être appelé sous <WizardProvider>');
  return ctx;
}
