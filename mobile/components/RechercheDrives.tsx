import { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  basculerChoix, dernieresParDrive, DRIVES_RECHERCHE, estEnAttente, ficheDepuisOffre, libelleStatut, NOMS_DRIVE, offresDuDrive, phase, prixLisible,
  type ChoixParDrive, type DriveRecherche, type OffreRelevee,
} from '../lib/recherche-drive.ts';
import { contenanceLisible, libellePrixUnitaire, lireMesures, ORDRE_UNITES, prixParUnite, prixUnitaireLisible, uniteCommune, type Mesures } from '../lib/caracteristiques.ts';
import { plusPetits } from '../lib/analyse-comparatif.ts';
import { lookupEan, type FicheProduit } from '../lib/openfoodfacts.ts';
import { annulerRecherche, demanderFiches, demanderRecherches, garderOffres, useRecherchesDrive } from '../stores/recherches-drive';
import { useProducts } from '../stores/products';
import { FicheOffre, TableauComparatif, type LigneComparatif } from './FicheOffre';
import { Photo, ui } from './MaisonUI';
import { colors } from '../lib/theme';

const contenance = (o: OffreRelevee) => o.volume_ml ? (o.volume_ml >= 1000 ? `${String(o.volume_ml / 1000).replace('.', ',')} L` : `${o.volume_ml} ml`) : o.grammage_g ? `${o.grammage_g} g` : null;
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
 * « Chercher sur les drives » dans Préciser (maquette CD) : l'extension cherche
 * le produit sur Carrefour puis E.Leclerc depuis Chrome, sur l'ordinateur ; les
 * résultats reviennent ici en temps réel. On coche pour comparer, on garde un
 * produit, ou un par drive.
 */
export function RechercheDrives({ requete, ean13, autres, onGarde, onPhase }: {
  requete: string; ean13?: string | null;
  /** Dit au parent où en est la recherche : son pied change pendant l'attente. */
  onPhase?: (p: ReturnType<typeof phase>) => void;
  /** Les autres points à préciser : « Tout envoyer » les cherche dans la même séance. */
  autres: string[];
  onGarde: (productId: string) => void;
}) {
  const { recherches, offres, chargement, recharger, fichesEnCours } = useRecherchesDrive(requete);
  const { recharger: rechargerProduits } = useProducts();
  const [envoi, setEnvoi] = useState(false), [erreur, setErreur] = useState<string | null>(null);
  const [coches, setCoches] = useState<string[]>([]), [ouverts, setOuverts] = useState<Partial<Record<DriveRecherche, boolean>>>({});
  const [comparer, setComparer] = useState(false), [garde, setGarde] = useState<string | null>(null), [lot, setLot] = useState(false);
  const etape = phase(recherches, offres), dernieres = dernieresParDrive(recherches);
  useEffect(() => { if (!chargement) onPhase?.(etape); }, [etape, chargement]);
  // VoiceOver n'a pas de région live : on annonce l'arrivée des résultats et les erreurs.
  const annoncer = (t: string) => { if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(t); };
  useEffect(() => { if (!chargement && etape === 'resultats') annoncer(`${offres.length} produit${offres.length > 1 ? 's' : ''} trouvé${offres.length > 1 ? 's' : ''} sur tes drives.`); }, [etape, chargement]);
  useEffect(() => { if (erreur) annoncer(erreur); }, [erreur]);

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
  const garder = async (choisies: OffreRelevee[]) => {
    setGarde(choisies.map(o => o.id).join(',')); setErreur(null);
    const r = await garderOffres(choisies, requete);
    setGarde(null);
    if (!r.ok || !r.productId) { setErreur(r.erreur ?? null); return; }
    setComparer(false);
    await rechargerProduits();
    onGarde(r.productId);
  };
  const cocher = (id: string) => setCoches(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);
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
    {etape === 'attente' && autres.length > 0 && <View style={s.carteLigne}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.titrePetit}>{autres.length === 1
          ? (lot ? 'L’autre point est en file aussi' : 'L’autre point aussi ?')
          : (lot ? `Les ${autres.length} autres sont en file aussi` : `Les ${autres.length} autres aussi ?`)}</Text>
        <Text style={s.texte}>{lot ? 'Une seule séance de recherche, sur ton ordinateur.' : 'Ils partiront dans la même séance.'}</Text>
      </View>
      {!lot && <Pressable accessibilityRole="button" accessibilityLabel={autres.length === 1 ? 'Chercher aussi l’autre point sur les drives' : `Chercher aussi les ${autres.length} autres points sur les drives`} disabled={envoi} onPress={() => { void toutEnvoyer(); }} style={({ pressed }) => [s.secondaire, pressed && { opacity: .8 }]}>
        {envoi ? <ActivityIndicator color={colors.accent} /> : <Text style={s.secondaireTexte}>Tout envoyer</Text>}
      </Pressable>}
    </View>}
    {pied}
  </View>;

  const cochees = offres.filter(o => coches.includes(o.id));
  return <View style={s.bloc}>
    <View style={s.entete}>
      <Text style={s.section} accessibilityRole="header">Sur tes drives</Text>
    </View>
    {DRIVES_RECHERCHE.map(d => {
      const liste = offresDuDrive(offres, d), r = dernieres[d], tout = ouverts[d] || liste.length <= PREMIERS + 1;
      return <View key={d} style={{ gap: 6 }}>
        <View style={s.sousEntete}>
          <Text style={s.drive} accessibilityRole="header" accessibilityLabel={NOMS_DRIVE[d]}>{NOMS_DRIVE[d].toUpperCase()}</Text>
          <Text style={s.quand}>{r && !estEnAttente(r.statut) && liste.length ? ilYa(r.faite_le) : libelleStatut(r)}</Text>
        </View>
        {liste.length > 0 && <View style={s.liste}>
          {(tout ? liste : liste.slice(0, PREMIERS)).map((o, i, vus) => {
            const coche = coches.includes(o.id), detail = [contenance(o), prixLisible(o.prix), prixLisible(o.prix_unitaire, o.unite_prix), o.disponible ? null : 'indisponible'].filter(Boolean).join(' · ');
            // Toucher la ligne la coche pour comparer ; « Garder » est le seul geste qui choisit.
            return <View key={o.id} style={[s.offre, (i < vus.length - 1 || !tout) && s.separee]}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: coche }} accessibilityLabel={`Comparer ${o.libelle}, ${[detail, o.promotion].filter(Boolean).join(', ')}`}
                accessibilityHint="Appui long pour voir la fiche détaillée" onPress={() => cocher(o.id)} onLongPress={() => voir(o)} delayLongPress={350}
                style={({ pressed }) => [s.offreCoche, pressed && { opacity: .7 }]}>
                <View style={[s.boite, coche && s.boiteCochee]}>{coche && <Feather name="check" size={14} color={colors.accentContrast} />}</View>
                <Photo name={o.libelle} url={o.image_url} style={s.photo} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={ui.productName} numberOfLines={2}>{o.libelle}</Text>
                  {!!detail && <Text style={[ui.detail, { marginTop: 0 }]} numberOfLines={1}>{detail}</Text>}
                  {!!o.promotion && <Text style={s.promo} numberOfLines={1}>{insecable(o.promotion)}</Text>}
                </View>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Garder ${o.libelle}, sur ${NOMS_DRIVE[d]}`} disabled={!!garde} hitSlop={6} onPress={() => { void garder([o]); }} style={({ pressed }) => [s.garder, pressed && { opacity: .8 }]}>
                {garde === o.id ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={s.garderTexte}>Garder</Text>}
              </Pressable>
            </View>;
          })}
          {!tout && <Pressable accessibilityRole="button" onPress={() => setOuverts(x => ({ ...x, [d]: true }))} style={s.voir}><Text style={ui.link}>Voir les {liste.length - PREMIERS} autres</Text></Pressable>}
        </View>}
      </View>;
    })}
    {cochees.length >= 2 && <Pressable accessibilityRole="button" accessibilityLabel={`Comparer les ${cochees.length} produits`} onPress={() => setComparer(true)} style={({ pressed }) => [s.secondaireLarge, pressed && { opacity: .8 }]}>
      <Feather name="columns" size={16} color={colors.accent} /><Text style={s.secondaireTexte}>Comparer les {cochees.length} produits</Text>
    </Pressable>}
    <Text style={[s.texte, s.marge]}>Touche des produits pour les comparer. « Garder » l’ajoute à « Mes produits », déjà relié à son drive.</Text>
    {pied}
    <FicheOffre fiche={detail?.fiche ?? null} proches={[]} onFermer={() => setDetail(null)} action="Garder ce produit"
      enseigne={detail ? [NOMS_DRIVE[detail.offre.drive], prixLisible(detail.offre.prix), contenance(detail.offre), detail.offre.promotion].filter(Boolean).join(' · ') : null}
      onChoisir={() => { const o = detail?.offre; setDetail(null); if (o) void garder([o]); }} />
    <ComparerOffres visible={comparer} offres={cochees} occupe={!!garde} erreur={comparer ? erreur : null} fichesEnCours={fichesEnCours}
      onOuvert={() => { void demanderFiches(cochees, fichesEnCours).then(() => recharger()); }} onFermer={() => setComparer(false)} onGarder={o => { void garder(o); }} />
  </View>;
}

/**
 * Le comparatif des offres cochées (CD 3 bis) : le tableau de l'ordre d'essai,
 * au plus un choix par drive. Il s'adapte au produit : la contenance lue dans
 * le libellé (mètres, feuilles, lavages, grammes…) et le prix ramené à cette
 * mesure ; les fiches Open Food, Beauty et Products Facts des codes-barres
 * connus ajoutent Nutri-Score, NOVA et repères ; le meilleur de chaque ligne
 * est en vert. À deux, chaque panier prendra celui de son drive.
 */
function ComparerOffres({ visible, offres, occupe, erreur, fichesEnCours, onOuvert, onFermer, onGarder }: {
  visible: boolean; offres: OffreRelevee[]; occupe: boolean; erreur: string | null;
  /** Les fiches que l'extension lit en ce moment, pour compléter les contenances. */
  fichesEnCours: string[]; onOuvert: () => void;
  onFermer: () => void; onGarder: (o: OffreRelevee[]) => void;
}) {
  // À l'ouverture, les fiches qui manquent sont demandées à l'extension ; le tableau se complète à leur arrivée.
  useEffect(() => { if (visible) onOuvert(); }, [visible]);
  const lecture = offres.filter(o => fichesEnCours.includes(o.id)).length;
  const [choix, setChoix] = useState<ChoixParDrive>({});
  // Les fiches des bases ouvertes, par offre : undefined tant qu'on cherche, null si rien.
  const [fiches, setFiches] = useState<Record<string, FicheProduit | null>>({});
  const cles = offres.map(o => o.id).join(',');
  useEffect(() => {
    if (!visible) return;
    let actif = true;
    for (const o of offres) {
      if (o.id in fiches) continue;
      if (!o.ean13) { setFiches(f => ({ ...f, [o.id]: null })); continue; }
      void lookupEan(o.ean13).then(r => { if (actif) setFiches(f => ({ ...f, [o.id]: r.etat === 'trouve' ? r.fiche : null })); })
        .catch(() => { if (actif) setFiches(f => ({ ...f, [o.id]: null })); });
    }
    return () => { actif = false; };
  }, [visible, cles]);
  const attente = offres.some(o => !(o.id in fiches));

  const choisies = offres.filter(o => choix[o.drive] === o.id);
  // Les mesures : le libellé d'abord, puis le relevé du drive et la fiche ouverte pour le poids ou le volume.
  const mesures: Mesures[] = offres.map(o => {
    const m = lireMesures(o.libelle, o.fiche_texte), f = fiches[o.id];
    const g = m.g ?? o.grammage_g ?? f?.grammageG ?? null, ml = m.ml ?? o.volume_ml ?? f?.volumeMl ?? null;
    return { ...m, ...(g ? { g: Number(g) } : {}), ...(ml ? { ml: Number(ml) } : {}) } as Mesures;
  });
  const unite = uniteCommune(mesures);
  const parUnite = offres.map((o, i) => (unite ? prixParUnite(o.prix, mesures[i], unite) : null));
  const colonnes = offres.map(o => { const f = fiches[o.id];
    return { ean13: o.id, name: o.libelle, brand: o.marque, imageUrl: o.image_url ?? f?.imageUrl ?? null, grammageG: o.grammage_g, volumeMl: o.volume_ml,
      productType: null, categoryKey: null, nutriscore: o.nutriscore ?? f?.nutriscore ?? null, ...(f?.details ? { details: f.details } : {}) }; });
  const estime = (i: number) => !!(unite && mesures[i].estime?.[unite]);
  const contenance = (m: Mesures) => {
    const u = unite && m[unite] != null ? unite : ORDRE_UNITES.find(x => m[x] != null);
    return u ? `${m.estime?.[u] ? '≈ ' : ''}${contenanceLisible(u, m[u]!)}` : NC;
  };
  // Une base n'est citée que si elle a apporté quelque chose : repères, Nutri-Score ou contenance.
  const sources = [...new Set(offres.map(o => { const f = fiches[o.id];
    return f && (f.details || f.nutriscore || f.grammageG || f.volumeMl) ? f.origine ?? 'Open Food Facts' : null; }).filter(Boolean))];
  const releve = offres.reduce((p, o) => (!p || o.vu_le < p ? o.vu_le : p), '' as string);
  const avant: LigneComparatif[] = [
    ['drive', 'Drive', (_, i) => <Text style={s.pastille}>{NOMS_DRIVE[offres[i].drive]}</Text>],
    ['prix', 'Prix au drive', (_, i) => offres[i].prix != null ? <Text style={s.prix}>{prixLisible(offres[i].prix)}</Text> : <Text style={s.nc}>{NC}</Text>],
    // Une ligne vide pour tous n'apprend rien : contenance, prix à la mesure, promo, dispo et fiche n'apparaissent que si l'un en a.
    ...(mesures.some(m => Object.keys(m).length) ? [['contenance', 'Contenance', (_, i) => <Text style={s.cellule}>{contenance(mesures[i])}</Text>] as LigneComparatif] : []),
    ...(unite ? [['unite', libellePrixUnitaire(unite), (_, i) => <Text style={parUnite[i] != null ? s.cellule : s.nc}>{parUnite[i] != null ? `${estime(i) ? '≈ ' : ''}${prixUnitaireLisible(parUnite[i]!, unite)}` : NC}</Text>] as LigneComparatif] : []),
    ...(offres.some(o => o.promotion) ? [['promo', 'Promo', (_, i) => <Text style={offres[i].promotion ? [s.cellule, { color: colors.attentionText, fontWeight: '700' }] : s.nc}>{offres[i].promotion ? insecable(offres[i].promotion!) : NC}</Text>] as LigneComparatif] : []),
    ...(offres.some(o => !o.disponible) ? [['dispo', 'Dispo', (_, i) => <Text style={s.cellule}>{offres[i].disponible ? 'en stock' : 'indisponible'}</Text>] as LigneComparatif] : []),
  ];
  const resume = (d: DriveRecherche) => {
    const o = choisies.find(x => x.drive === d), autre = choisies.find(x => x.drive !== d);
    return o ? o.libelle : autre ? `le même : ${autre.libelle}` : 'rien de choisi';
  };
  const n = choisies.length;
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFermer}>
    <SafeAreaView edges={['bottom']} style={s.ecran}>
      <View style={s.barre}>
        <Pressable accessibilityRole="button" onPress={onFermer} style={s.bouton}><Text style={s.boutonTexte}>Fermer</Text></Pressable>
        <Text style={s.titreBarre} accessibilityRole="header">Comparer</Text>
        <View style={[s.bouton, { alignItems: 'flex-end' }]}>{attente && <ActivityIndicator accessibilityLabel="Recherche des fiches produits" color={colors.accent} />}</View>
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 24, gap: 14 }}>
        {lecture > 0 && <View style={s.lecture} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[s.texte, { flex: 1 }]}>Lecture {lecture > 1 ? `des ${lecture} fiches` : 'de la fiche'} sur Carrefour : les contenances se complètent d’elles-mêmes.</Text>
        </View>}
        <Text style={[s.texte, { paddingHorizontal: 16 }]}>Garde un produit par drive, ou un seul pour les deux. Un 2ᵉ sur le même drive remplace le 1er.</Text>
        <TableauComparatif colonnes={colonnes} avant={avant} meilleursAvant={{ unite: plusPetits(parUnite), prix: plusPetits(offres.map(o => o.prix)) }} enAvant={offres.flatMap((o, i) => choix[o.drive] === o.id ? [i] : [])}
          pied={(_, i) => { const o = offres[i], pris = choix[o.drive] === o.id;
            return <Pressable accessibilityRole="button" accessibilityState={{ selected: pris }} accessibilityLabel={`${pris ? 'Ne plus garder' : 'Garder'} ${o.libelle} pour ${NOMS_DRIVE[o.drive]}`}
              onPress={() => setChoix(c => basculerChoix(c, o))} style={[s.choisir, pris && s.choisi]}>
              {pris && <Feather name="check" size={14} color={colors.accentContrast} />}
              <Text style={[s.choisirTexte, pris && { color: colors.accentContrast }]}>{pris ? 'Gardé' : 'Garder'}</Text>
            </Pressable>; }} />
        <Text style={[s.texte, { textAlign: 'center', paddingHorizontal: 16 }]}>
          {[`Le meilleur de chaque ligne en vert. Prix relevés ${ilYa(releve) ?? ''}.`, offres.some((_, i) => estime(i)) ? '« ≈ » : mètres estimés d’après la taille des feuilles.' : null, sources.length ? `Repères : ${sources.join(', ')}.` : null].filter(Boolean).join(' ')}
        </Text>
      </ScrollView>
      <View style={s.validation}>
        {!!erreur && <Text style={[ui.error, { textAlign: 'center' }]}>{erreur}</Text>}
        {DRIVES_RECHERCHE.map(d => <View key={d} style={s.resume}><Text style={s.etatDrive}>{NOMS_DRIVE[d]}</Text>
          <Text style={[s.resumeTexte, !choisies.some(x => x.drive === d) && { color: colors.textMuted, fontWeight: '400' }]} numberOfLines={1}>{resume(d)}</Text></View>)}
        <Pressable accessibilityRole="button" disabled={!n || occupe} onPress={() => onGarder(choisies)} style={[s.principal, (!n || occupe) && s.inactif]}>
          {occupe ? <ActivityIndicator color={colors.accentContrast} /> : <Text style={[s.principalTexte, !n && { color: colors.offText }]}>{n === 2 ? 'Garder ces 2 produits' : n === 1 ? 'Garder ce produit' : 'Choisis au moins un produit'}</Text>}
        </Pressable>
        <Text style={[s.texte, { textAlign: 'center', fontSize: 12 }]}>{n === 2 ? 'Chaque panier prend celui de son drive ; l’un devient l’alternative de l’autre.' : n === 1 ? 'Un seul produit : il est cherché sur les deux drives.' : 'Rien ne change tant que tu n’as pas choisi.'}</Text>
      </View>
    </SafeAreaView>
  </Modal>;
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
  comparer: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.accentSoft },
  comparerTexte: { fontSize: 14, fontWeight: '600', color: colors.accent },
  sousEntete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 4 },
  drive: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: colors.textMuted },
  quand: { fontSize: 12, color: colors.textMuted },
  liste: { backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' },
  offre: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingRight: 12 },
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
  lecture: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
});
