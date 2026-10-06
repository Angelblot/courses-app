import { abandonner, cleDistinct, etapeDeReprise, manquesDuBrouillon, restaurerHabitude, rouvrirManque as rouvrir, type InstantaneHabitude, type Manque, type SessionStep } from '../lib/session-courses';
import { retenirFrequent, type Frequent } from '../lib/extras-frequents';
import { WidgetSync } from '../components/WidgetSync';
import { importerAjouts } from '../lib/widget-products';
import { annulerReprise, cleRappel, importerRappels, lireArticles, type Reprise } from '../lib/rappels';
import { nativeInbox, nativeRappels } from '../lib/native-inbox';
import { enregistrerLiaison, lireLiaison } from '../stores/rappels';
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
  /** Paires déclarées distinctes à la saisie (cleDistinct) : plus jamais redemandées. */
  distincts?: string[];
  importsExternes?: string[];
  /** Articles repris de Rappels à la dernière ouverture : le message et son « Annuler ». */
  derniereReprise?: Reprise;
  /** Extras déjà notés, proposés en un tap. Survit à la remise à zéro de la liste. */
  extrasFrequents?: Record<string, Frequent>;
  habitudesVues?: Record<string, boolean>;
  /** Envoi dont on ignore s'il est parti (coupure) : le prochain essai garde cet identifiant. */
  envoiEnDoute?: string;
  ligneQuantites: Record<string, number>;
  lignePossedees: Record<string, boolean>;
  selectedRecipes: Record<string, number>;
  quotidien: Record<string, 'needed' | 'have'>;
  quotidienQty: Record<string, number>;
  extras: LigneExtra[];
  /** Produit retenu par groupe d'ingrédients, à l'étape 3. */
  choixProduits: Record<string, string>;
  /** Ingrédients de repas gardés sans produit au bilan : l'extension les cherchera par leur nom. */
  ingredientsSansProduit?: string[];
  /** Ce qu'on ajoute en plus de la part des repas, par produit (Habitudes et liste). La part des repas suit les recettes. */
  enPlus?: Record<string, number>;
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
  /** Défait le règlement d'un manque, depuis l'état d'avant (« Changer » dans Préciser). */
  rouvrirManque: (key: string, avant: Etat, productId?: string) => void;
  /** Oublie une paire déclarée distincte : le doublon se repose. */
  oublierDistinct: (a: string, b: string) => void;
  accepterDoublon: (id: string) => void;
  declarerDistinct: (a: string, b: string) => void;
  pret: boolean; sauvegardeErreur: string | null;
  modifierLigne: (key: string, n: number) => void;
  /** Remet la quantité d'une ligne telle qu'elle était, pour annuler un retrait. */
  restaurerLigne: (key: string, avant: number | undefined) => void;
  possederLigne: (key: string, owned: boolean) => void;
  ajouterProduitListe: (id: string, quantite?: number, manque?: boolean) => void;
  deciderHabituel: (id: string, quantite: number, acheter: boolean) => void;
  annulerHabituel: (id: string, avant: InstantaneHabitude) => void;
  retenirExtra: (ajout: { name: string; productId?: string }) => void;
  revoirHabitudes: (ids: string[]) => void;
  toggleRecette: (id: string, partsParDefaut: number) => void;
  setParts: (id: string, n: number) => void;
  marquerProduit: (id: string, statut: 'needed' | 'have' | null) => void;
  setQuantite: (id: string, n: number) => void;
  /** Renvoie l'identifiant de l'extra créé. */
  ajouterExtra: (e: Omit<LigneExtra, 'id'>, manque?: boolean) => string;
  retirerExtra: (id: string) => void;
  choisirProduit: (cleGroupe: string, produitId: string) => void;
  oublierChoixProduit: (cleGroupe: string) => void;
  /** Marque des habitudes comme passées en revue, sans rien décider pour elles (produits déjà pris par les repas). */
  marquerVues: (ids: string[]) => void;
  ajouterEnPlus: (id: string, n: number) => void;
  garderIngredient: (cleGroupe: string, garder: boolean) => void;
  basculerDrive: (nom: string) => void;
  reinitialiser: () => void;
  /** Retient l'identifiant d'un envoi incertain, ou l'oublie (undefined). */
  retenirEnvoi: (id?: string) => void;
  /** Abandonne les courses en cours ; les manques notés restent. Annulable. */
  abandonnerSession: () => void;
  abandonEnAttente: boolean;
  annulerAbandon: () => void;
  oublierAbandon: () => void;
  /** Le message de reprise Rappels a été montré. */
  voirReprise: () => void;
  /** Retire la dernière reprise Rappels et décoche ses articles dans Rappels. */
  annulerRepriseRappels: () => void;
  /** Relit tout de suite les ajouts Siri, widget et Rappels (après avoir relié une liste). */
  actualiserAjouts: () => void;
  /** Le compte connecté : clé des réglages propres à cet appareil. */
  compte: string | null;
};

const WizardCtx = createContext<Contexte | null>(null);

export function WizardProvider({ children, userId }: { children: ReactNode; userId: string | null }) {
  const [etat, setEtat] = useState<Etat>(INITIAL);
  const [pret, setPret] = useState(!userId);
  const [stockagePret, setStockagePret] = useState(false);
  const [sauvegardeErreur, setSauvegardeErreur] = useState<string | null>(null);
  const ecritures = useRef(Promise.resolve());
  // Articles lus dans Rappels, cochés là-bas une fois enregistrés ici.
  const aCocher = useRef<string[]>([]);
  const etatRef = useRef(etat);
  const relancer = useRef<() => void>(() => {});
  etatRef.current = etat;
  const cle = `tablee-maison-v1:${userId}`;
  useEffect(() => {
    let actif = true;
    if (!userId) return;
    AsyncStorage.getItem(cle).then(brut => {
      if (!actif) return;
      if (brut) {
        const data = JSON.parse(brut);
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Brouillon invalide');
        setEtat({ ...INITIAL, ...data, sessionEtape: etapeDeReprise(data.sessionEtape) });
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
        const repris = new Set(etat.importsExternes ?? []);
        const ids = aCocher.current.filter(id => repris.has(cleRappel(id)));
        if (nativeRappels && ids.length) {
          // En cas d'échec, l'article reste non coché dans Rappels mais n'est pas repris deux fois.
          try { await nativeRappels.cocher(ids, true); aCocher.current = aCocher.current.filter(id => !ids.includes(id)); } catch { /* retenté à la prochaine ouverture */ }
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
      await reprendreRappels();
    }
    // Ce que Siri a rangé dans la liste Rappels reliée. Silencieux en cas d'échec : la liste attend la prochaine ouverture.
    async function reprendreRappels() {
      try {
        if (!nativeRappels || !userId || !stockagePret) return;
        const liaison = await lireLiaison(userId);
        if (!liaison || await nativeRappels.statut() !== 'autorise') return;
        const lu = await nativeRappels.lire(liaison.id);
        if (!actif || !lu) return;
        const articles = lireArticles(lu.articles);
        aCocher.current = [...new Set([...aCocher.current, ...articles.map(a => a.id)])];
        const deja = new Set(etatRef.current.importsExternes ?? []);
        const n = articles.filter(a => !deja.has(cleRappel(a.id))).length;
        setEtat(e => importerRappels(e, lu.titre, articles));
        if (n) await enregistrerLiaison(userId, { ...liaison, titre: lu.titre, derniere: { n, le: new Date().toISOString() } });
      } catch { /* prochaine ouverture */ }
    }
    void importer();
    relancer.current = () => { void importer(); };
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void importer(); });
    return () => { actif = false; listener.remove(); };
  }, [userId, stockagePret]);
  const modifierLigne = useCallback((key: string, n: number) => setEtat(e => ({ ...e, ligneQuantites: { ...e.ligneQuantites, [key]: Math.max(0, Math.ceil(n)) } })), []);
  const restaurerLigne = useCallback((key: string, avant: number | undefined) => setEtat(e => { const ligneQuantites = { ...e.ligneQuantites }; if (avant === undefined) delete ligneQuantites[key]; else ligneQuantites[key] = avant; return { ...e, ligneQuantites }; }), []);
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
  const annulerHabituel = useCallback((id: string, avant: InstantaneHabitude) => setEtat(e => restaurerHabitude(e, id, avant)), []);
  const retenirExtra = useCallback((ajout: { name: string; productId?: string }) => setEtat(e => ({ ...e, extrasFrequents: retenirFrequent(e.extrasFrequents ?? {}, ajout) })), []);
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
    return extraId;
  }, [compteur]);

  const retirerExtra = useCallback((id: string) => {
    setEtat((e) => ({ ...e, extras: e.extras.filter((x) => x.id !== id) }));
  }, []);

  const choisirProduit = useCallback((cleGroupe: string, produitId: string) => {
    setEtat((e) => ({ ...e, choixProduits: { ...e.choixProduits, [cleGroupe]: produitId } }));
  }, []);

  const oublierChoixProduit = useCallback((cleGroupe: string) => {
    setEtat((e) => { const { [cleGroupe]: _, ...reste } = e.choixProduits; return { ...e, choixProduits: reste }; });
  }, []);
  const marquerVues = useCallback((ids: string[]) => setEtat(e => ({ ...e, habitudesVues: { ...e.habitudesVues, ...Object.fromEntries(ids.map(id => [id, true])) } })), []);
  const ajouterEnPlus = useCallback((id: string, n: number) => setEtat(e => {
    const enPlus = { ...(e.enPlus ?? {}) }; if (n > 0) enPlus[id] = Math.round(n); else delete enPlus[id];
    return { ...e, enPlus, habitudesVues: { ...e.habitudesVues, [id]: true } };
  }), []);
  const garderIngredient = useCallback((cleGroupe: string, garder: boolean) => {
    setEtat((e) => { const l = (e.ingredientsSansProduit ?? []).filter(k => k !== cleGroupe); return { ...e, ingredientsSansProduit: garder ? [...l, cleGroupe] : l }; });
  }, []);

  const basculerDrive = useCallback((nom: string) => {
    setEtat((e) => ({
      ...e,
      drives: e.drives.includes(nom) ? e.drives.filter((d) => d !== nom) : [...e.drives, nom],
    }));
  }, []);

  const reinitialiser = useCallback(() => setEtat(e => ({ ...INITIAL, importsExternes: e.importsExternes, extrasFrequents: e.extrasFrequents })), []);

  const demarrerSession = useCallback(() => setEtat(e => e.sessionEtape ? e : { ...e,
    manques: manquesDuBrouillon(e), sessionEtape: 'recettes', habitudesVues: {}, doublonsValides: [],
  }), []);
  const retenirEnvoi = useCallback((id?: string) => setEtat(e => ({ ...e, envoiEnDoute: id })), []);
  const allerEtape = useCallback((sessionEtape: SessionStep) => setEtat(e => ({ ...e, sessionEtape })), []);
  const declarerDistinct = useCallback((a: string, b: string) => setEtat(e => ({ ...e, distincts: [...(e.distincts ?? []), cleDistinct(a, b)] })), []);
  const rouvrirManque = useCallback((key: string, avant: Etat, productId?: string) => setEtat(e => rouvrir(e, avant, key, productId)), []);
  const oublierDistinct = useCallback((a: string, b: string) => setEtat(e => ({ ...e, distincts: (e.distincts ?? []).filter(d => d !== cleDistinct(a, b)) })), []);
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

  const [avantAbandon, setAvantAbandon] = useState<Etat | null>(null);
  const abandonnerSession = useCallback(() => { setAvantAbandon(etat); setEtat(abandonner(etat)); }, [etat]);
  const annulerAbandon = useCallback(() => { if (avantAbandon) setEtat(avantAbandon); setAvantAbandon(null); }, [avantAbandon]);
  const oublierAbandon = useCallback(() => setAvantAbandon(null), []);
  const actualiserAjouts = useCallback(() => relancer.current(), []);
  const voirReprise = useCallback(() => setEtat(e => e.derniereReprise && !e.derniereReprise.vue ? { ...e, derniereReprise: { ...e.derniereReprise, vue: true } } : e), []);
  const annulerRepriseRappels = useCallback(() => {
    const ids = etatRef.current.derniereReprise?.ids ?? [];
    setEtat(annulerReprise);
    if (nativeRappels && ids.length) void nativeRappels.cocher(ids, false).catch(() => {});
  }, []);

  const valeur = useMemo<Contexte>(() => ({
    ...etat, demarrerSession, allerEtape, validerManque, rouvrirManque, oublierDistinct, accepterDoublon, declarerDistinct, pret, sauvegardeErreur, modifierLigne, restaurerLigne, possederLigne, ajouterProduitListe, deciderHabituel, annulerHabituel, retenirExtra, revoirHabitudes,
    toggleRecette, setParts, marquerProduit, setQuantite,
    ajouterExtra, retirerExtra, choisirProduit, oublierChoixProduit, marquerVues, ajouterEnPlus, garderIngredient, basculerDrive, reinitialiser, retenirEnvoi,
    abandonnerSession, abandonEnAttente: avantAbandon !== null, annulerAbandon, oublierAbandon, voirReprise, annulerRepriseRappels, actualiserAjouts, compte: userId,
  }), [
    etat, demarrerSession, allerEtape, validerManque, rouvrirManque, oublierDistinct, accepterDoublon, declarerDistinct, pret, sauvegardeErreur, modifierLigne, restaurerLigne, possederLigne, ajouterProduitListe, deciderHabituel, annulerHabituel, retenirExtra, revoirHabitudes, toggleRecette, setParts, marquerProduit, setQuantite,
    ajouterExtra, retirerExtra, choisirProduit, oublierChoixProduit, marquerVues, ajouterEnPlus, garderIngredient, basculerDrive, reinitialiser, retenirEnvoi,
    abandonnerSession, avantAbandon, annulerAbandon, oublierAbandon, voirReprise, annulerRepriseRappels, actualiserAjouts, userId,
  ]);

  if (!pret) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7F2' }}><ActivityIndicator color="#48613A" /><Text>Restauration de ta liste…</Text></View>;
  return <WizardCtx.Provider value={valeur}>{nativeInbox && userId && stockagePret ? <WidgetSync account={userId} state={etat} writes={ecritures} rattacher={setEtat} /> : null}{children}</WizardCtx.Provider>;
}

export function useWizard(): Contexte {
  const ctx = useContext(WizardCtx);
  if (!ctx) throw new Error('useWizard doit être appelé sous <WizardProvider>');
  return ctx;
}
