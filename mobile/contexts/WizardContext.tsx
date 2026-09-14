import { manquesDuBrouillon, type Manque, type SessionStep } from '../lib/session-courses';
import { WidgetSync } from '../components/WidgetSync';
import { importerAjouts } from '../lib/widget-products';
import { nativeInbox } from '../lib/native-inbox';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, AppState, View, Text } from 'react-native';
import {
  createContext, useCallback, useContext, useMemo, useState, useEffect, useRef, type ReactNode,
} from 'react';
import type { CleRayon } from '../lib/rayons.ts';

export type LigneExtra = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  rayon: CleRayon;
};

export type Etat = {
  sessionEtape?: SessionStep;
  manques?: Record<string, Manque>;
  doublonsValides?: string[];
  importsExternes?: string[];
  habitudesVues?: Record<string, boolean>;
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
  demarrerSession: () => void;
  allerEtape: (etape: SessionStep) => void;
  validerManque: (key: string, quantity: number, productId?: string) => void;
  accepterDoublon: (id: string) => void;
  pret: boolean; sauvegardeErreur: string | null;
  modifierLigne: (key: string, n: number) => void;
  possederLigne: (key: string, owned: boolean) => void;
  ajouterProduitListe: (id: string, quantite?: number, manque?: boolean) => void;
  deciderHabituel: (id: string, quantite: number, acheter: boolean) => void;
  revoirHabitudes: (ids: string[]) => void;
  toggleRecette: (id: string, partsParDefaut: number) => void;
  setParts: (id: string, n: number) => void;
  marquerProduit: (id: string, statut: 'needed' | 'have' | null) => void;
  setQuantite: (id: string, n: number) => void;
  ajouterExtra: (e: Omit<LigneExtra, 'id'>, manque?: boolean) => void;
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
      .then(async () => {
        setSauvegardeErreur(null);
        // Acknowledge only IDs committed to durable account storage.
        if (nativeInbox) {
          try { await nativeInbox.acknowledge(userId, etat.importsExternes ?? []); }
          catch { setSauvegardeErreur('Ta liste est enregistrée. La synchronisation des ajouts Siri et widget sera retentée à la prochaine ouverture.'); }
        }
      })
      .catch(() => setSauvegardeErreur('Le brouillon n’a pas pu être enregistré sur cet appareil.'));
  }, [etat, pret, stockagePret, cle, userId]);
  useEffect(() => {
    let actif = true;
    if (!nativeInbox) return;
    async function importer() {
      try {
        await nativeInbox!.setSession(userId);
        if (!actif || !userId || !stockagePret) return;
        const pending = await nativeInbox!.read(userId);
        if (!actif) return;
        setEtat(e => {
          return importerAjouts(e, pending);
        });
      } catch { if (actif) setSauvegardeErreur('Les ajouts Siri et widget ne sont pas accessibles. Ouvre les réglages pour vérifier la configuration iPhone.'); }
    }
    void importer();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void importer(); });
    return () => { actif = false; listener.remove(); };
  }, [userId, stockagePret]);
  const modifierLigne = useCallback((key: string, n: number) => setEtat(e => ({ ...e, ligneQuantites: { ...e.ligneQuantites, [key]: Math.max(0, Math.ceil(n)) } })), []);
  const possederLigne = useCallback((key: string, owned: boolean) => setEtat(e => ({ ...e, lignePossedees: { ...e.lignePossedees, [key]: owned } })), []);
  const ajouterProduitListe = useCallback((id: string, quantite = 1, manque?: boolean) => setEtat(e => ({ ...e,
    manques: !(manque ?? !e.sessionEtape) ? e.manques : { ...manquesDuBrouillon(e), [`produit:${id}`]: { name: 'Produit enregistré', source: 'manuel', valide: false } },
    quotidien: { ...e.quotidien, [id]: 'needed' },
    quotidienQty: { ...e.quotidienQty, [id]: (e.quotidien[id] === 'needed' ? e.quotidienQty[id] ?? 1 : 0) + Math.max(1, Math.round(quantite)) },
    lignePossedees: { ...e.lignePossedees, [`produit:${id}`]: false },
    ligneQuantites: Object.fromEntries(Object.entries(e.ligneQuantites).filter(([k]) => k !== `produit:${id}`)),
  })), []);
  const deciderHabituel = useCallback((id: string, quantite: number, acheter: boolean) => setEtat(e => ({ ...e,
    habitudesVues: { ...e.habitudesVues, [id]: true },
    quotidien: { ...e.quotidien, [id]: acheter ? 'needed' : 'have' },
    quotidienQty: { ...e.quotidienQty, [id]: Math.max(1, Math.round(quantite)) },
    ligneQuantites: { ...e.ligneQuantites, [`produit:${id}`]: Math.max(1, Math.round(quantite)) },
    lignePossedees: { ...e.lignePossedees, [`produit:${id}`]: !acheter },
  })), []);
  const revoirHabitudes = useCallback((ids: string[]) => setEtat(e=>({...e, habitudesVues: Object.fromEntries(Object.entries(e.habitudesVues??{}).filter(([id])=>!ids.includes(id)))})), []);
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

  const ajouterExtra = useCallback((extra: Omit<LigneExtra, 'id'>, manque?: boolean) => {
    const extraId = `extra-${Date.now()}-${compteur}-${Math.random().toString(36).slice(2,8)}`;
    setCompteur((c) => c + 1);
    setEtat((e) => ({
      ...e,
      extras: [...e.extras, { ...extra, id: extraId }],
      manques: !(manque ?? !e.sessionEtape) ? e.manques : { ...manquesDuBrouillon(e), [`extra:${extraId}`]: { name: extra.name, source: 'manuel' } },
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

  const reinitialiser = useCallback(() => setEtat(e => ({ ...INITIAL, importsExternes: e.importsExternes })), []);

  const demarrerSession = useCallback(() => setEtat(e => e.sessionEtape ? e : { ...e,
    manques: manquesDuBrouillon(e), sessionEtape: 'recettes', habitudesVues: {}, doublonsValides: [],
  }), []);
  const allerEtape = useCallback((sessionEtape: SessionStep) => setEtat(e => ({ ...e, sessionEtape })), []);
  const accepterDoublon = useCallback((id: string) => setEtat(e=>({...e,doublonsValides:[...(e.doublonsValides??[]),id]})),[]);
  const validerManque = useCallback((key: string, quantity: number, productId?: string) => setEtat(e => {
    const qty = Math.max(1, Math.round(quantity));
    const manques = { ...manquesDuBrouillon(e) }, manque = manques[key];
    if (!manque) return e;
    const quotidien = {...e.quotidien}, quotidienQty = {...e.quotidienQty}, ligneQuantites = {...e.ligneQuantites}, lignePossedees = {...e.lignePossedees};
    let extras = [...e.extras];
    const target = productId ? `produit:${productId}` : key;
    if (productId) {
      if (key.startsWith('produit:') && key !== target) { delete quotidien[key.slice(8)]; delete quotidienQty[key.slice(8)]; }
      if (key.startsWith('extra:')) extras = extras.filter(x=>`extra:${x.id}`!==key);
      quotidien[productId] = 'needed'; quotidienQty[productId] = qty;
      delete ligneQuantites[target]; lignePossedees[target] = false;
    } else { extras = extras.map(x=>`extra:${x.id}`===key ? {...x,quantity:qty} : x); delete ligneQuantites[key]; }
    if (target !== key) { delete manques[key]; delete ligneQuantites[key]; delete lignePossedees[key]; }
    manques[target] = {...manque,valide:true};
    return {...e,manques,quotidien,quotidienQty,extras,ligneQuantites,lignePossedees};
  }),[]);

  const valeur = useMemo<Contexte>(() => ({
    ...etat, demarrerSession, allerEtape, validerManque, accepterDoublon, pret, sauvegardeErreur, modifierLigne, possederLigne, ajouterProduitListe, deciderHabituel, revoirHabitudes,
    toggleRecette, setParts, marquerProduit, setQuantite,
    ajouterExtra, retirerExtra, choisirProduit, basculerDrive, reinitialiser,
  }), [
    etat, demarrerSession, allerEtape, validerManque, accepterDoublon, pret, sauvegardeErreur, modifierLigne, possederLigne, ajouterProduitListe, deciderHabituel, revoirHabitudes, toggleRecette, setParts, marquerProduit, setQuantite,
    ajouterExtra, retirerExtra, choisirProduit, basculerDrive, reinitialiser,
  ]);

  if (!pret) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7F2' }}><ActivityIndicator color="#48613A" /><Text>Restauration de ta liste…</Text></View>;
  return <WizardCtx.Provider value={valeur}>{nativeInbox && userId && stockagePret ? <WidgetSync account={userId} state={etat} writes={ecritures} /> : null}{children}</WizardCtx.Provider>;
}

export function useWizard(): Contexte {
  const ctx = useContext(WizardCtx);
  if (!ctx) throw new Error('useWizard doit être appelé sous <WizardProvider>');
  return ctx;
}
