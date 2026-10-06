import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  choisirOffre, colonnesComparatif, dernieresParDrive, DRIVES_RECHERCHE, estEnAttente, ficheDepuisOffre, libelleStatut, NOMS_DRIVE, offresDuDrive, ongletApres, phase, prixLisible,
  type ChoixOffres, type DriveRecherche, type OffreRelevee,
} from '../lib/recherche-drive.ts';
import { contenanceLisible, libellePrixUnitaire, lireMesures, ORDRE_UNITES, prixParUnite, prixUnitaireLisible, uniteCommune, type Mesures, type Unite } from '../lib/caracteristiques.ts';
import { nomCourt, plusPetits } from '../lib/analyse-comparatif.ts';
import { lookupEan, type FicheProduit } from '../lib/openfoodfacts.ts';
import { annulerRecherche, demanderFiches, demanderRecherches, useRecherchesDrive } from '../stores/recherches-drive';
import { useProducts } from '../stores/products';
import { useDejaAchete } from '../stores/deja-achete';
import { dejaAchetes, type Connu } from '../lib/deja-achete.ts';
import { normaliserNom, produitsProches } from '../lib/session-courses.ts';
import { correspond, parleDe, requeteAffinee, suggestions, type Suggestion } from '../lib/affinage.ts';
import { FicheOffre, TableauComparatif, type LigneComparatif } from './FicheOffre';
import { Photo, ui } from './MaisonUI';
import { colors } from '../lib/theme';

/** Les mesures d'une offre : son libellé, la fiche lue sur le drive, puis le poids ou le volume relevés (ou ceux des bases ouvertes). */
const mesuresDe = (o: OffreRelevee, f?: FicheProduit | null): Mesures => {
  const m = lireMesures(o.libelle, o.fiche_texte);
  const g = m.g ?? o.grammage_g ?? f?.grammageG ?? null, ml = m.ml ?? o.volume_ml ?? f?.volumeMl ?? null;
  return { ...m, ...(g ? { g: Number(g) } : {}), ...(ml ? { ml: Number(ml) } : {}) } as Mesures;
};
/** La description lue sur la fiche du drive : ce qui suit « Description », jusqu'aux caractéristiques. */
const descriptionDe = (o: OffreRelevee): string | null => {
  const t = o.fiche_texte?.split(/Description \| /)[1]?.split(/ \| (?:Caract[ée]ristiques|Voir plus)/)[0]?.replace(/ \| /g, ' · ').trim();
  return t ? t.slice(0, 600) : null;
};
/** « 15 m », « ≈ 8,4 m » : dans la mesure commune si le produit l'a, sinon la plus parlante qu'il ait. */
const contenanceDe = (m: Mesures, unite?: Unite | null): string | null => {
  const u = unite && m[unite] != null ? unite : ORDRE_UNITES.find(x => m[x] != null);
  return u ? `${m.estime?.[u] ? '≈ ' : ''}${contenanceLisible(u, m[u]!)}` : null;
};
const ilYa = (iso: string | null) => {
  if (!iso) return null;
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return min < 1 ? 'à l’instant' : min < 60 ? `il y a ${min} min` : min < 1440 ? `il y a ${Math.round(min / 60)} h` : `le ${new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
};
const PREMIERS = 3;
/** Cellule sans valeur : « n.c. » plutôt qu'un tiret. */
const NC = 'n.c.';
/** « -30 % » reste sur une ligne. */
const insecable = (t: string) => t.replace(/ %/g, '\u00a0%');

/**
 * « Chercher sur les drives » dans Préciser : l'extension cherche le produit
 * sur Carrefour puis E.Leclerc depuis Chrome ; les résultats reviennent ici en
 * temps réel. Variante A validée : un onglet par enseigne, choisir un produit
 * fait passer à l'autre, la barre du bas (dans Préciser) récapitule et valide ;
 * le comparatif groupe les deux enseignes. Le choix appartient au parent.
 */
/** Le mode comparaison : les produits cochés pour le comparatif, et s'il est ouvert. null : on choisit. */
export type Comparaison = { coches: string[]; ouvert: boolean } | null;
/** Ce que Préciser montre à côté du nom : types et marques à proposer, et la recherche approfondie en cours. */
export type Affinage = { actif: boolean; types: Suggestion[]; marques: Suggestion[]; enCours: boolean; trouves: number };
/** Une même offre vue par les deux recherches (large et approfondie) ne compte qu'une fois. */
const cleOffre = (o: OffreRelevee) => `${o.drive}:${o.ean13 ?? normaliserNom(o.libelle)}`;
const annoncerTexte = (t: string) => { if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(t); };
/** Où en est la recherche approfondie sur un drive, en mots. */
const etatApprofondi = (statut: string | undefined, nouveaux: number) => !statut ? 'pas lancée' : statut === 'en_attente' ? 'en attente' : statut === 'en_cours' ? 'en cours…'
  : statut === 'verification' ? 'vérification demandée' : statut === 'echec' ? 'n’a pas abouti' : nouveaux ? `${nouveaux} nouveau${nouveaux > 1 ? 'x' : ''}` : 'rien de plus';

export function RechercheDrives({ requete, ean13, autres, onPhase, choix, onChoix, onValider, occupe, erreurValider, comparaison, onComparaison, onNombres, filtre = null, onAffinage }: {
  requete: string; ean13?: string | null;
  /** Dit au parent où en est la recherche : son pied change pendant l'attente et avec les résultats. */
  onPhase?: (p: ReturnType<typeof phase>) => void;
  /** Les autres points à préciser : « Tout envoyer » les cherche dans la même séance. */
  autres: string[];
  /** Le choix en cours, une offre par enseigne, et sa validation (portés par Préciser). */
  choix: ChoixOffres; onChoix: (c: ChoixOffres) => void;
  onValider: (offres: OffreRelevee[]) => void; occupe: boolean; erreurValider: string | null;
  /** Le mode comparaison, porté lui aussi par Préciser : son pied fixe offre « Comparer » à portée du pouce. */
  comparaison: Comparaison; onComparaison: (c: Comparaison) => void;
  /** Combien de produits chaque enseigne propose : le pied sait s'il reste une enseigne à choisir. */
  onNombres?: (n: Record<DriveRecherche, number>) => void;
  /** Le type ou la marque choisis dans « Quel type ? » : filtre instantané, puis recherche approfondie. */
  filtre?: string | null; onAffinage?: (a: Affinage) => void;
}) {
  const { recherches, offres: offresBase, chargement, recharger, fichesEnCours } = useRecherchesDrive(requete);
  // Un type choisi : les offres déjà relevées qui en sont, puis celles de la recherche approfondie (« Bière IPA »).
  const affinee = filtre ? requeteAffinee(requete, filtre) : '';
  const approfondie = useRecherchesDrive(affinee);
  // Le produit déjà choisi reste visible, même s'il n'est pas du type choisi.
  const filtrees = filtre ? offresBase.filter(o => correspond(o.libelle, filtre) || DRIVES_RECHERCHE.some(d => choix[d]?.id === o.id)) : offresBase;
  const vues = new Set(filtrees.map(cleOffre));
  // La recherche approfondie ne garde que ce qui parle de l'article : un drive sans réponse précise renvoie n'importe quoi.
  const nouvelles = filtre ? approfondie.offres.filter(o => !vues.has(cleOffre(o)) && (parleDe(o.libelle, requete) || correspond(o.libelle, filtre))).map(o => ({ ...o, approfondie: true, rang: 1000 + (o.rang ?? 0) })) : [];
  const offres = [...filtrees, ...nouvelles];
  const dernieresAff = dernieresParDrive(approfondie.recherches);
  const enCoursAff = (d: DriveRecherche) => !!filtre && !!dernieresAff[d] && estEnAttente(dernieresAff[d]!.statut);
  // Moins de 5 produits du type sur une enseigne : on y cherche le type lui-même (déjà fait à l'avance chez Carrefour, le plus souvent).
  useEffect(() => {
    if (!filtre || approfondie.chargement) return;
    const manquants = DRIVES_RECHERCHE.filter(d => offresDuDrive(filtrees, d).length < 5 && !dernieresAff[d]);
    if (manquants.length) void demanderRecherches([{ requete: affinee, drives: manquants }], { siAbsente: true }).then(() => approfondie.recharger());
  }, [filtre, approfondie.chargement]);
  const [envoi, setEnvoi] = useState(false), [erreur, setErreur] = useState<string | null>(null);
  const [ouverts, setOuverts] = useState<Partial<Record<DriveRecherche, boolean>>>({}), [onglet, setOnglet] = useState<DriveRecherche | null>(null);
  const [lot, setLot] = useState(false);
  // Les mesures de toutes les offres, et la mesure commune : le prix comparable se lit dès la liste.
  const mesures = new Map(offres.map(o => [o.id, mesuresDe(o)]));
  const unite = uniteCommune([...mesures.values()]);
  const meilleurs = new Set(plusPetits(offres.map(o => (unite ? prixParUnite(o.prix, mesures.get(o.id)!, unite) : null))).map(i => offres[i].id));
  const etape = phase(recherches, offresBase), dernieres = dernieresParDrive(recherches);
  const sugg = suggestions(requete, offresBase), enCours = DRIVES_RECHERCHE.some(enCoursAff);
  const affinage: Affinage = { actif: !chargement && etape === 'resultats', ...sugg, enCours, trouves: offres.length };
  useEffect(() => { onAffinage?.(affinage); }, [JSON.stringify(affinage)]);
  // VoiceOver : le début et la fin de la recherche approfondie sont annoncés (pas de région live sur iOS).
  const avantEnCours = useRef(false);
  useEffect(() => {
    if (enCours && !avantEnCours.current) annoncerTexte(`On cherche d’autres « ${affinee} » sur les drives.`);
    if (!enCours && avantEnCours.current && filtre) annoncerTexte(`${offres.length} produit${offres.length > 1 ? 's' : ''} « ${filtre} » trouvé${offres.length > 1 ? 's' : ''}.`);
    avantEnCours.current = enCours;
  }, [enCours]);
  // Tes produits reconnus dans les offres (ou achetés là), en tête de chaque onglet.
  const { produits } = useProducts();
  const proches = produitsProches(requete, produits, 8).map(p => p.id);
  const { achats, liens } = useDejaAchete(proches, [...new Set(offres.map(o => o.ean13).filter((e): e is string => !!e))]);
  const connusPar = Object.fromEntries(DRIVES_RECHERCHE.map(d => [d, dejaAchetes(d, offres, produits, achats, liens, proches)])) as Record<DriveRecherche, Connu[]>;
  // Un choix fait avant l'arrivée de l'historique se rattache à ton produit dès qu'il est reconnu : pas de doublon.
  const rattachements = DRIVES_RECHERCHE.map(d => { const c = choix[d]; const connu = c && !c.produit_id ? connusPar[d].find(x => x.offre.id === c.id) : undefined; return connu ? [d, connu.offre] as const : null; }).filter(Boolean) as (readonly [DriveRecherche, OffreRelevee])[];
  useEffect(() => { if (rattachements.length) onChoix({ ...choix, ...Object.fromEntries(rattachements) }); }, [rattachements.map(([d, o]) => `${d}:${o.id}`).join(',')]);
  const comptes = DRIVES_RECHERCHE.map(d => offresDuDrive(offres, d).length + connusPar[d].filter(c => c.absent).length);
  useEffect(() => { onNombres?.({ carrefour: comptes[0], leclerc: comptes[1] }); }, [comptes.join(',')]);
  useEffect(() => { if (!chargement) onPhase?.(etape); }, [etape, chargement]);
  // VoiceOver n'a pas de région live : on annonce l'arrivée des résultats et les erreurs.
  const annoncer = (t: string) => { if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(t); };
  useEffect(() => { if (!chargement && etape === 'resultats') annoncer(`${offres.length} produit${offres.length > 1 ? 's' : ''} trouvé${offres.length > 1 ? 's' : ''} sur tes drives.`); }, [etape, chargement]);
  useEffect(() => { if (erreur) annoncer(erreur); }, [erreur]);
  // Dès que les résultats arrivent, les fiches des premiers produits Carrefour sont lues : la liste se complète d'elle-même.
  const premiers = offresDuDrive(offres, 'carrefour').slice(0, 4);
  useEffect(() => { if (!chargement && etape === 'resultats') void demanderFiches(premiers, fichesEnCours); }, [etape, chargement, premiers.map(o => o.id).join(',')]);

  const demander = async () => {
    setEnvoi(true); setErreur(null);
    const r = await demanderRecherches([{ requete, ean13 }]);
    setEnvoi(false);
    if (!r.ok) setErreur(r.erreur ?? null); else await recharger();
  };
  const toutEnvoyer = async () => {
    setEnvoi(true); setErreur(null);
    const r = await demanderRecherches(autres.map(a => ({ requete: a })));
    setEnvoi(false);
    if (r.ok) setLot(true); else setErreur(r.erreur ?? null);
  };
  const annuler = async () => { const r = await annulerRecherche(requete); if (!r.ok) setErreur(r.erreur ?? null); else await recharger(); };
  // Appui long : la vue détaillée, comme ailleurs, enrichie des bases ouvertes quand le code-barres y est.
  const [detail, setDetail] = useState<{ offre: OffreRelevee; fiche: FicheProduit } | null>(null);
  const voir = (o: OffreRelevee) => {
    const base = ficheDepuisOffre(o);
    setDetail({ offre: o, fiche: base });
    if (o.ean13) void lookupEan(o.ean13).then(r => {
      if (r.etat !== 'trouve') return;
      setDetail(d => d?.offre.id !== o.id ? d : { offre: o, fiche: { ...base, imageUrl: base.imageUrl ?? r.fiche.imageUrl, nutriscore: base.nutriscore ?? r.fiche.nutriscore,
        grammageG: base.grammageG ?? r.fiche.grammageG, volumeMl: base.volumeMl ?? r.fiche.volumeMl, ...(r.fiche.details ? { details: r.fiche.details } : {}) } });
    }).catch(() => {});
  };

  if (chargement) return null;
  const pied = !!erreur && <Text accessibilityLiveRegion="polite" style={[ui.error, s.marge]}>{erreur}</Text>;

  // Un seul geste, une seule ligne d'explication : le bouton dit déjà où l'on cherche.
  if (etape === 'aucune') return <View style={s.bloc}>
    <Pressable accessibilityRole="button" accessibilityLabel="Chercher sur Carrefour et E.Leclerc" accessibilityHint="L’extension Chrome le cherche depuis ton ordinateur ; les résultats reviennent ici." disabled={envoi}
      onPress={() => { void demander(); }} style={({ pressed }) => [s.principal, s.principalIcone, (pressed || envoi) && { opacity: .85 }]}>
      {envoi ? <ActivityIndicator color={colors.accentContrast} /> : <><Feather name="search" size={17} color={colors.accentContrast} /><Text style={s.principalTexte}>Chercher sur Carrefour et E.Leclerc</Text></>}
    </Pressable>
    <Text style={[s.texte, { textAlign: 'center' }]}>Par l’extension Chrome, sur ton ordinateur.</Text>
    {pied}
  </View>;

  // Une seule ligne d'état quand les deux drives en sont au même point ; le bandeau du pied porte l'avancement.
  const libelles = DRIVES_RECHERCHE.map(d => libelleStatut(dernieres[d]));
  const etats = libelles.every(l => l === libelles[0])
    ? <View style={s.etat} accessible><Text style={s.etatDrive}>Carrefour puis E.Leclerc</Text><Text style={s.etatTexte}>{libelles[0]}</Text></View>
    : <View style={{ gap: 6 }}>{DRIVES_RECHERCHE.map((d, i) => <View key={d} style={s.etat} accessible><Text style={s.etatDrive}>{NOMS_DRIVE[d]}</Text><Text style={s.etatTexte}>{libelles[i]}</Text></View>)}</View>;
  const echec = etape === 'sans_resultat' && Object.values(dernieres).every(r => r?.statut === 'echec');

  if (etape !== 'resultats') return <View style={s.bloc}>
    <View style={s.carte}>
      <View style={s.ligneIcone}>
        <View style={s.rond}><Feather name={etape === 'attente' ? 'clock' : 'search'} size={20} color={colors.accent} /></View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.titre}>{etape === 'attente' ? 'Recherche en file' : echec ? 'La recherche n’a pas abouti' : 'Rien trouvé sur les drives'}</Text>
          <Text style={s.texte}>{etape === 'attente'
            ? 'Les résultats reviendront ici, même si tu passes au point suivant.'
            : echec ? 'Relance-la, ou garde-le sans produit : l’extension le cherchera par son nom au remplissage.'
              : 'Garde-le sans produit : l’extension le cherchera par son nom au remplissage. Ou relance la recherche.'}</Text>
        </View>
      </View>
      {etats}
      {etape === 'attente'
        ? <Pressable accessibilityRole="button" onPress={() => { void annuler(); }} hitSlop={6} style={s.lien}><Text style={s.lienDiscret}>Annuler la recherche</Text></Pressable>
        : <Pressable accessibilityRole="button" disabled={envoi} onPress={() => { void demander(); }} hitSlop={6} style={s.lien}><Text style={ui.link}>Relancer la recherche</Text></Pressable>}
    </View>
    {pied}
  </View>;

  // Variante A : un onglet par enseigne. Choisir fait passer à l'autre ; la barre du bas récapitule et valide.
  // Par enseigne : tes produits reconnus d'abord, puis les autres offres du drive.
  const connusIci = Object.fromEntries(DRIVES_RECHERCHE.map(d => [d, connusPar[d].map(c => c.offre)])) as Record<DriveRecherche, OffreRelevee[]>;
  const parDrive = Object.fromEntries(DRIVES_RECHERCHE.map(d => [d, offresDuDrive(offres, d).filter(o => !connusIci[d].some(c => c.id === o.id))])) as Record<DriveRecherche, OffreRelevee[]>;
  const nombres = Object.fromEntries(DRIVES_RECHERCHE.map(d => [d, parDrive[d].length + connusIci[d].length])) as Record<DriveRecherche, number>;
  const actif = onglet ?? (nombres.carrefour ? 'carrefour' : 'leclerc');
  const liste = parDrive[actif], connus = connusIci[actif], tout = ouverts[actif] || liste.length <= PREMIERS + 1;
  const choisir = (o: OffreRelevee) => { const suite = choisirOffre(choix, o); onChoix(suite); setOnglet(ongletApres(suite, o.drive, nombres)); };
  const autre = DRIVES_RECHERCHE.find(d => d !== actif)!;
  const enComparaison = !!comparaison;
  const consigne = enComparaison ? 'Coche les produits à comparer'
    : choix[actif] && (choix[autre] || !nombres[autre]) ? 'Tout est choisi, tu peux valider'
    : choix[actif] ? `Puis ton produit ${NOMS_DRIVE[autre]}`
    : choix[autre] ? `Puis ton produit ${NOMS_DRIVE[actif]}` : `Choisis ton produit ${NOMS_DRIVE[actif]}`;
  const cocher = (o: OffreRelevee) => { if (!comparaison) return; const c = comparaison.coches;
    onComparaison({ ...comparaison, coches: c.includes(o.id) ? c.filter(x => x !== o.id) : [...c, o.id] }); };
  // Les produits cochés, groupés par enseigne dans l'ordre du drive : les colonnes du comparatif.
  const cochees = DRIVES_RECHERCHE.flatMap(d => [...connusIci[d], ...parDrive[d]].filter(o => comparaison?.coches.includes(o.id)));
  const releve = dernieres[actif] && !estEnAttente(dernieres[actif]!.statut) && liste.length ? `Prix relevés ${ilYa(dernieres[actif]!.faite_le)}. ` : '';
  const rang = (o: OffreRelevee, separee: boolean) => {
        const pris = choix[actif]?.id === o.id, coche = !!comparaison?.coches.includes(o.id), m = mesures.get(o.id) ?? mesuresDe(o), pu = unite ? prixParUnite(o.prix, m, unite) : null;
        const cont = contenanceDe(m), detail = [cont, o.historique ? 'dernier prix payé · absent des derniers résultats' : null, o.disponible ? null : 'indisponible'].filter(Boolean).join(' · ');
        // En comparaison, toucher coche ; sinon, toucher choisit le produit de l'enseigne.
        return <Pressable key={o.id} accessibilityRole={enComparaison ? 'checkbox' : 'radio'} accessibilityState={{ checked: enComparaison ? coche : pris }}
          accessibilityLabel={`${o.libelle}, ${[o.histoire, o.historique ? 'dernier prix payé, absent des derniers résultats' : null, o.disponible ? null : 'indisponible', prixLisible(o.prix), pu != null && unite ? prixUnitaireLisible(pu, unite) : null, cont, o.promotion].filter(Boolean).join(', ')}`}
          accessibilityHint="Appui long pour voir la fiche détaillée" onPress={() => (enComparaison ? cocher(o) : choisir(o))} onLongPress={() => voir(o)} delayLongPress={350}
          style={({ pressed }) => [s.offre, separee && s.separee, (enComparaison ? coche : pris) && s.offrePrise, pressed && { opacity: .75 }]}>
          {enComparaison && <View style={[s.boite, coche && s.boiteCochee]}>{coche && <Feather name="check" size={14} color={colors.accentContrast} />}</View>}
          <Photo name={o.libelle} url={o.image_url} style={s.photo} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={ui.productName} numberOfLines={2}>{o.libelle}</Text>
            {!!o.histoire && <Text style={s.histoire} numberOfLines={2}>{o.histoire}</Text>}
            {!o.histoire && o.approfondie && <View style={s.pastilleNouveau}><Text style={s.pastilleNouveauTexte}>Nouveau</Text></View>}
            {!!detail && <Text style={[ui.detail, { marginTop: 0 }]} numberOfLines={1}>{detail}</Text>}
            {!!o.promotion && <Text style={s.promo} numberOfLines={1}>{insecable(o.promotion)}</Text>}
          </View>
          <View style={s.prixColonne}>
            <Text style={s.prixListe}>{prixLisible(o.prix) ?? NC}</Text>
            {pu != null && unite && <Text style={[s.unite, meilleurs.has(o.id) && s.uniteMeilleure]}>{m.estime?.[unite] ? '≈ ' : ''}{prixUnitaireLisible(pu, unite)}</Text>}
          </View>
          {!enComparaison && <View style={[s.radio, pris && s.radioPris]}>{pris && <View style={s.radioPoint} />}</View>}
        </Pressable>;
  };
  return <View style={s.bloc}>
    <View accessibilityRole="tablist" style={s.onglets}>
      {DRIVES_RECHERCHE.map(d => {
        const sel = d === actif, r = dernieres[d];
        const sous = choix[d] ? 'choisi' : filtre && !nombres[d] ? `aucun « ${filtre} »` : nombres[d] ? `${nombres[d]} produit${nombres[d] > 1 ? 's' : ''}` : libelleStatut(r);
        return <Pressable key={d} accessibilityRole="tab" accessibilityState={{ selected: sel }} accessibilityLabel={`${NOMS_DRIVE[d]}, ${enCoursAff(d) ? `${nombres[d] ? `${nombres[d]} produits, ` : ''}recherche en cours` : sous}`} onPress={() => setOnglet(d)} style={[s.onglet, sel && s.ongletActif]}>
          <Text style={s.ongletNom}>{NOMS_DRIVE[d]}</Text>
          <View style={s.ongletSous}>{enCoursAff(d) ? <ActivityIndicator size="small" color={colors.accent} style={{ transform: [{ scale: .7 }] }} /> : choix[d] && <Feather name="check" size={12} color="#2F6B2F" />}
            <Text style={[s.ongletEtat, choix[d] && !enCoursAff(d) && { color: '#2F6B2F' }]}>{enCoursAff(d) ? (nombres[d] ? `${nombres[d]} · recherche…` : 'recherche…') : sous}</Text></View>
        </Pressable>;
      })}
    </View>
    {/* « Comparer » en haut, toujours visible : les bons candidats sont en tête de liste. */}
    {enCours && <View style={[s.carte, s.carteAvance]} accessible
      accessibilityLabel={`On cherche d’autres « ${affinee} ». ${DRIVES_RECHERCHE.map(d => `${NOMS_DRIVE[d]} : ${etatApprofondi(dernieresAff[d]?.statut, nouvelles.filter(o => o.drive === d).length)}`).join('. ')}`}>
      <Text style={s.titrePetit}>On cherche d’autres « {affinee} »</Text>
      <BarreEnCours />
      <View style={{ gap: 4 }}>{DRIVES_RECHERCHE.map(d => { const n = nouvelles.filter(o => o.drive === d).length, st = dernieresAff[d]?.statut;
        return <View key={d} style={s.resume}><Text style={s.etatDrive}>{NOMS_DRIVE[d]}</Text><Text style={[s.etatTexte, st === 'faite' && n > 0 && { color: colors.accent, fontWeight: '600' }]}>{etatApprofondi(st, n)}</Text></View>; })}</View>
    </View>}
    <View style={s.sousEntete}>
      <Text style={s.consigne}>{consigne}</Text>
    </View>
    {connus.length > 0 && <>
      <Text style={s.sectionConnus} accessibilityRole="header">Déjà acheté ici</Text>
      <View style={[s.liste, s.listeConnus]}>{connus.map((o, i) => rang(o, i < connus.length - 1))}</View>
      {liste.length > 0 && <Text style={s.sectionAutres} accessibilityRole="header">Autres produits {NOMS_DRIVE[actif]}</Text>}
    </>}
    {liste.length > 0 ? <View style={s.liste}>
      {(tout ? liste : liste.slice(0, PREMIERS)).map((o, i, vus) => rang(o, i < vus.length - 1 || !tout))}
      {!tout && <Pressable accessibilityRole="button" onPress={() => setOuverts(x => ({ ...x, [actif]: true }))} style={s.voir}><Text style={ui.link}>Voir les {liste.length - PREMIERS} autres</Text></Pressable>}
    </View> : !connus.length && filtre ? <View style={s.carte}><Text style={s.texte}>{enCoursAff(actif)
      ? `Pas encore de « ${filtre} » chez ${NOMS_DRIVE[actif]} : on en cherche.` : `Pas de « ${filtre} » chez ${NOMS_DRIVE[actif]}. Touche le type pour en changer.`}</Text></View>
    : !connus.length && <View style={s.carte}><Text style={s.texte}>{dernieres[actif] && estEnAttente(dernieres[actif]!.statut)
      ? `${NOMS_DRIVE[actif]} n’a pas encore répondu : ${libelleStatut(dernieres[actif])}.` : `Rien trouvé sur ${NOMS_DRIVE[actif]}. Tu peux valider le seul produit ${NOMS_DRIVE[autre]}.`}</Text></View>}
    <Text style={[s.texte, s.marge, { textAlign: 'center' }]}>{releve}Appui long sur un produit pour sa fiche.{unite && [...mesures.values()].some(m => m.estime?.[unite]) ? ' « ≈ » : mètres estimés d’après la taille des feuilles.' : ''}</Text>
    {pied}
    <FicheOffre fiche={detail?.fiche ?? null} proches={[]} onFermer={() => setDetail(null)} description={detail ? descriptionDe(detail.offre) : null}
      action={detail ? (choix[detail.offre.drive]?.id === detail.offre.id ? 'Ne plus choisir' : `Choisir pour ${NOMS_DRIVE[detail.offre.drive]}`) : undefined}
      enseigne={detail ? [NOMS_DRIVE[detail.offre.drive], prixLisible(detail.offre.prix), contenanceDe(mesures.get(detail.offre.id) ?? {}), detail.offre.promotion].filter(Boolean).join(' · ') : null}
      onChoisir={() => { const o = detail?.offre; setDetail(null); if (o) choisir(o); }} />
    <ComparerOffres visible={!!comparaison?.ouvert} offres={cochees} choix={choix} onChoix={onChoix} occupe={occupe} erreur={comparaison?.ouvert ? erreurValider : null} fichesEnCours={fichesEnCours}
      onOuvert={() => { void demanderFiches(cochees, fichesEnCours).then(() => recharger()); }} onFermer={() => comparaison && onComparaison({ ...comparaison, ouvert: false })} onValider={onValider} />
  </View>;
}

/**
 * Le comparatif groupé par enseigne : les produits cochés, sous un bandeau
 * Carrefour et un bandeau E.Leclerc (une seule enseigne s'il le faut), les
 * libellés figés à gauche. Il s'adapte au produit (contenance lue dans le
 * libellé et la fiche du drive, prix ramené à la même mesure) ; les bases
 * ouvertes complètent Nutri-Score, NOVA et repères. Un choix par enseigne,
 * puis « Valider ».
 */
function ComparerOffres({ visible, offres: toutes, choix, onChoix, occupe, erreur, fichesEnCours, onOuvert, onFermer, onValider }: {
  visible: boolean; offres: OffreRelevee[]; choix: ChoixOffres; onChoix: (c: ChoixOffres) => void; occupe: boolean; erreur: string | null;
  /** Les fiches que l'extension lit en ce moment, pour compléter les contenances. */
  fichesEnCours: string[]; onOuvert: () => void;
  onFermer: () => void; onValider: (o: OffreRelevee[]) => void;
}) {
  // À l'ouverture, les fiches qui manquent sont demandées à l'extension ; le tableau se complète à leur arrivée.
  useEffect(() => { if (visible) onOuvert(); }, [visible]);
  // Les produits cochés, groupés par enseigne (ils arrivent dans cet ordre).
  const offres = toutes;
  const lecture = offres.filter(o => fichesEnCours.includes(o.id)).length;
  // Les fiches des bases ouvertes, par offre : undefined tant qu'on cherche, null si rien.
  const [fiches, setFiches] = useState<Record<string, FicheProduit | null>>({});
  const cles = offres.map(o => o.id).join(',');
  useEffect(() => {
    if (!visible) return;
    let vivant = true;
    for (const o of offres) {
      if (o.id in fiches) continue;
      if (!o.ean13) { setFiches(f => ({ ...f, [o.id]: null })); continue; }
      void lookupEan(o.ean13).then(r => { if (vivant) setFiches(f => ({ ...f, [o.id]: r.etat === 'trouve' ? r.fiche : null })); })
        .catch(() => { if (vivant) setFiches(f => ({ ...f, [o.id]: null })); });
    }
    return () => { vivant = false; };
  }, [visible, cles]);
  const attente = offres.some(o => !(o.id in fiches));

  const choisies = DRIVES_RECHERCHE.flatMap(d => (choix[d] ? [choix[d]!] : []));
  const mesures: Mesures[] = offres.map(o => mesuresDe(o, fiches[o.id]));
  const unite = uniteCommune(mesures);
  const parUnite = offres.map((o, i) => (unite ? prixParUnite(o.prix, mesures[i], unite) : null));
  const colonnes = offres.map(o => { const f = fiches[o.id];
    return { ean13: o.id, name: o.libelle, brand: o.marque, imageUrl: o.image_url ?? f?.imageUrl ?? null, grammageG: o.grammage_g, volumeMl: o.volume_ml,
      productType: null, categoryKey: null, nutriscore: o.nutriscore ?? f?.nutriscore ?? null, ...(f?.details ? { details: f.details } : {}) }; });
  const estime = (i: number) => !!(unite && mesures[i].estime?.[unite]);
  // Une base n'est citée que si elle a apporté quelque chose : repères, Nutri-Score ou contenance.
  const sources = [...new Set(offres.map(o => { const f = fiches[o.id];
    return f && (f.details || f.nutriscore || f.grammageG || f.volumeMl) ? f.origine ?? 'Open Food Facts' : null; }).filter(Boolean))];
  const releve = offres.reduce((p, o) => (!p || o.vu_le < p ? o.vu_le : p), '' as string);
  const avant: LigneComparatif[] = [
    ['prix', 'Prix', (_, i) => offres[i].prix != null ? <Text style={s.prix}>{prixLisible(offres[i].prix)}</Text> : <Text style={s.nc}>{NC}</Text>],
    // Une ligne vide pour tous n'apprend rien : contenance, prix à la mesure, promo et dispo n'apparaissent que si l'un en a.
    ...(mesures.some(m => Object.keys(m).length) ? [['contenance', 'Contenance', (_, i) => <Text style={s.cellule}>{contenanceDe(mesures[i], unite)}</Text>] as LigneComparatif] : []),
    ...(unite ? [['unite', libellePrixUnitaire(unite), (_, i) => <Text style={parUnite[i] != null ? s.cellule : s.nc}>{parUnite[i] != null ? `${estime(i) ? '≈ ' : ''}${prixUnitaireLisible(parUnite[i]!, unite)}` : NC}</Text>] as LigneComparatif] : []),
    ...(offres.some(o => o.promotion) ? [['promo', 'Promo', (_, i) => <Text style={offres[i].promotion ? [s.cellule, { color: colors.attentionText, fontWeight: '700' }] : s.nc}>{offres[i].promotion ? insecable(offres[i].promotion!) : NC}</Text>] as LigneComparatif] : []),
    ...(offres.some(o => !o.disponible) ? [['dispo', 'Dispo', (_, i) => <Text style={s.cellule}>{offres[i].disponible ? 'en stock' : 'indisponible'}</Text>] as LigneComparatif] : []),
  ];
  const groupes = DRIVES_RECHERCHE.map(d => ({ d, nombre: offres.filter(o => o.drive === d).length })).filter(g => g.nombre)
    .map(g => ({ titre: NOMS_DRIVE[g.d].toUpperCase(), etat: choix[g.d] ? 'choisi' : 'à choisir', nombre: g.nombre, actif: !!choix[g.d] }));
  const n = choisies.length;
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFermer}>
    <SafeAreaView edges={['bottom']} style={s.ecran}>
      <View style={s.barre}>
        <Pressable accessibilityRole="button" onPress={onFermer} style={s.bouton}><Text style={s.boutonTexte}>Fermer</Text></Pressable>
        <Text style={s.titreBarre} accessibilityRole="header">Comparer</Text>
        <View style={[s.bouton, { alignItems: 'flex-end' }]}>{attente && <ActivityIndicator accessibilityLabel="Recherche des fiches produits" color={colors.accent} />}</View>
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 4, paddingBottom: 24, gap: 12 }}>
        <Text style={[s.texte, { paddingHorizontal: 16 }]}>Un choix par enseigne. Appui long sur un produit pour sa fiche.</Text>
        {lecture > 0 && <View style={s.lecture} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[s.texte, { flex: 1 }]}>Lecture {lecture > 1 ? `des ${lecture} fiches` : 'de la fiche'} sur Carrefour : les contenances se complètent d’elles-mêmes.</Text>
        </View>}
        <TableauComparatif colonnes={colonnes} avant={avant} groupes={groupes} meilleursAvant={{ unite: plusPetits(parUnite), prix: plusPetits(offres.map(o => o.prix)) }}
          enAvant={offres.flatMap((o, i) => choix[o.drive]?.id === o.id ? [i] : [])}
          pied={(_, i) => { const o = offres[i], pris = choix[o.drive]?.id === o.id;
            return <Pressable accessibilityRole="button" accessibilityState={{ selected: pris }} accessibilityLabel={`${pris ? 'Ne plus choisir' : 'Choisir'} ${o.libelle} pour ${NOMS_DRIVE[o.drive]}`}
              onPress={() => onChoix(choisirOffre(choix, o))} style={[s.choisir, pris && s.choisi]}>
              {pris && <Feather name="check" size={14} color={colors.accentContrast} />}
              <Text style={[s.choisirTexte, pris && { color: colors.accentContrast }]}>{pris ? 'Choisi' : 'Choisir'}</Text>
            </Pressable>; }} />
        <Text style={[s.texte, { textAlign: 'center', paddingHorizontal: 16 }]}>
          {[`Vert : le meilleur de chaque ligne, toutes enseignes. Prix relevés ${ilYa(releve) ?? ''}.`, offres.some((_, i) => estime(i)) ? '« ≈ » : mètres estimés d’après la taille des feuilles.' : null, sources.length ? `Repères : ${sources.join(', ')}.` : null].filter(Boolean).join(' ')}
        </Text>
      </ScrollView>
      <View style={s.validation}>
        {!!erreur && <Text style={[ui.error, { textAlign: 'center' }]}>{erreur}</Text>}
        <Recapitulatif choix={choix} />
        <Pressable accessibilityRole="button" disabled={!n || occupe} onPress={() => onValider(choisies)} style={[s.principal, (!n || occupe) && s.inactif]}>
          {occupe ? <ActivityIndicator color={colors.accentContrast} /> : <Text style={[s.principalTexte, !n && { color: colors.offText }]}>{n === 2 ? 'Valider les 2 produits' : n === 1 ? 'Valider ce seul produit' : 'Choisis un produit'}</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  </Modal>;
}

/** Une barre qui glisse sans fin : la recherche avance, sans durée connue. Immobile si les animations sont réduites. */
function BarreEnCours() {
  const x = useRef(new Animated.Value(0)).current, [largeur, setLargeur] = useState(0);
  useEffect(() => {
    let boucle: Animated.CompositeAnimation | null = null, vivant = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(reduit => {
      // Animations réduites : la barre reste visible, au milieu, immobile.
      if (!vivant) return;
      if (reduit) { x.setValue(.45); return; }
      boucle = Animated.loop(Animated.timing(x, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }));
      boucle.start();
    });
    return () => { vivant = false; boucle?.stop(); };
  }, []);
  return <View style={s.barreAvance} onLayout={e => setLargeur(e.nativeEvent.layout.width)}>
    <Animated.View style={[s.barrePleine, { width: largeur * .4, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-largeur * .4, largeur] }) }] }]} />
  </View>;
}

/** Le récapitulatif du choix, une ligne par enseigne : le produit et son prix, ou « à choisir ». */
export function Recapitulatif({ choix }: { choix: ChoixOffres }) {
  return <View style={{ gap: 4 }}>
    {DRIVES_RECHERCHE.map(d => { const o = choix[d];
      return <View key={d} style={s.resume}><Text style={s.etatDrive}>{NOMS_DRIVE[d]}</Text>
        {o ? <><Text style={s.resumeTexte} numberOfLines={1}>{nomCourt(o.libelle)}</Text><Text style={s.resumePrix}>{prixLisible(o.prix) ?? NC}</Text></>
          : <Text style={[s.resumeTexte, { color: colors.textMuted, fontWeight: '400' }]}>à choisir</Text>}</View>; })}
  </View>;
}

const s = StyleSheet.create({
  bloc: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  marge: { paddingHorizontal: 4 },
  encart: { backgroundColor: colors.accentSoft, borderRadius: 16, padding: 16, gap: 12 },
  carte: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 14 },
  carteLigne: { backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ligneIcone: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  rond: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  titre: { fontSize: 15, fontWeight: '700', color: colors.text },
  titrePetit: { fontSize: 15, fontWeight: '600', color: colors.text },
  texte: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  principal: { minHeight: 48, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  principalTexte: { fontSize: 15, fontWeight: '600', color: colors.accentContrast },
  inactif: { backgroundColor: colors.off },
  principalIcone: { flexDirection: 'row', gap: 8 },
  secondaire: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  secondaireTexte: { fontSize: 14, fontWeight: '600', color: colors.accent },
  etat: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.bg, gap: 8 },
  etatDrive: { fontSize: 14, fontWeight: '600', color: colors.text },
  etatTexte: { fontSize: 13, color: colors.textMuted, flexShrink: 1, textAlign: 'right' },
  lien: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  lienDiscret: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 },
  section: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  sousEntete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4 },
  drive: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: colors.textMuted },
  quand: { fontSize: 12, color: colors.textMuted },
  liste: { backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' },
  listeConnus: { borderWidth: 1.5, borderColor: colors.accentSoft },
  sectionConnus: { fontSize: 12, fontWeight: '700', letterSpacing: .4, color: colors.accent, textTransform: 'uppercase', paddingHorizontal: 4, marginBottom: -4 },
  sectionAutres: { fontSize: 12, fontWeight: '700', letterSpacing: .4, color: colors.textMuted, textTransform: 'uppercase', paddingHorizontal: 4, marginTop: 4, marginBottom: -4 },
  histoire: { fontSize: 12, fontWeight: '600', color: colors.accent },
  carteAvance: { gap: 10, paddingVertical: 12 },
  pastilleNouveau: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: colors.accentSoft },
  pastilleNouveauTexte: { fontSize: 11, fontWeight: '700', color: colors.accent },
  barreAvance: { height: 4, borderRadius: 2, backgroundColor: colors.accentSoft, overflow: 'hidden' },
  barrePleine: { position: 'absolute', top: 0, bottom: 0, borderRadius: 2, backgroundColor: colors.accent },
  offre: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, paddingVertical: 8, paddingHorizontal: 12 },
  separee: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  case: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  boite: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.traitControle, alignItems: 'center', justifyContent: 'center' },
  boiteCochee: { backgroundColor: colors.accent, borderColor: colors.accent },
  photo: { width: 44, height: 44, borderRadius: 8 },
  offreCoche: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, paddingLeft: 10 },
  garder: { minHeight: 36, minWidth: 76, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  garderTexte: { fontSize: 14, fontWeight: '700', color: colors.accent },
  promo: { fontSize: 12, fontWeight: '700', color: colors.attentionText },
  nc: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  secondaireLarge: { minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderColor: colors.accent, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  voir: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  ecran: { flex: 1, backgroundColor: colors.bg },
  barre: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8, minHeight: 52 },
  bouton: { minWidth: 72, minHeight: 44, justifyContent: 'center' },
  boutonTexte: { fontSize: 17, color: colors.accent },
  titreBarre: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: colors.text },
  pastille: { fontSize: 11, fontWeight: '700', color: '#2F6B2F', backgroundColor: '#E7F0E1', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  prix: { fontSize: 14, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  date: { fontSize: 11, color: colors.textMuted },
  cellule: { fontSize: 12, color: colors.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  choisir: { alignSelf: 'stretch', minHeight: 44, paddingHorizontal: 6, borderRadius: 12, borderWidth: 1.5, borderColor: colors.accent, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' },
  choisi: { backgroundColor: colors.accent },
  choisirTexte: { fontSize: 13, fontWeight: '700', color: colors.accent },
  validation: { backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 8 },
  resume: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  resumeTexte: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '600', color: colors.text },
  resumePrix: { fontSize: 14, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  lecture: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  onglets: { flexDirection: 'row', backgroundColor: '#E4E7E0', borderRadius: 12, padding: 4, gap: 4 },
  onglet: { flex: 1, minHeight: 52, borderRadius: 9, alignItems: 'center', justifyContent: 'center', gap: 1 },
  ongletActif: { backgroundColor: colors.surface, shadowColor: '#141C10', shadowOpacity: .12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  ongletNom: { fontSize: 15, fontWeight: '700', color: colors.text },
  ongletSous: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ongletEtat: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  consigne: { fontSize: 14, fontWeight: '600', color: colors.text },
  offrePrise: { backgroundColor: '#EEF4E8' },
  prixColonne: { alignItems: 'flex-end', gap: 2, minWidth: 64 },
  prixListe: { fontSize: 15, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  unite: { fontSize: 12, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  uniteMeilleure: { fontWeight: '700', color: '#2F6B2F' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.traitControle, alignItems: 'center', justifyContent: 'center' },
  radioPris: { borderColor: colors.accent },
  radioPoint: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
});
