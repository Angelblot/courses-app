import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  basculerChoix, dernieresParDrive, DRIVES_RECHERCHE, estEnAttente, libelleStatut, NOMS_DRIVE, offresDuDrive, phase, prixLisible,
  type ChoixParDrive, type DriveRecherche, type OffreRelevee,
} from '../lib/recherche-drive.ts';
import { contenanceLisible, libellePrixUnitaire, lireMesures, ORDRE_UNITES, prixParUnite, prixUnitaireLisible, uniteCommune, type Mesures } from '../lib/caracteristiques.ts';
import { analyser, plusPetits } from '../lib/analyse-comparatif.ts';
import { lookupEan, type FicheProduit } from '../lib/openfoodfacts.ts';
import { annulerRecherche, demanderRecherches, garderOffres, useRecherchesDrive } from '../stores/recherches-drive';
import { useProducts } from '../stores/products';
import { TableauComparatif, type LigneComparatif } from './FicheOffre';
import { Photo, ui } from './MaisonUI';
import { colors } from '../lib/theme';

const contenance = (o: OffreRelevee) => o.volume_ml ? (o.volume_ml >= 1000 ? `${String(o.volume_ml / 1000).replace('.', ',')} L` : `${o.volume_ml} ml`) : o.grammage_g ? `${o.grammage_g} g` : null;
const ilYa = (iso: string | null) => {
  if (!iso) return null;
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return min < 1 ? 'à l’instant' : min < 60 ? `il y a ${min} min` : min < 1440 ? `il y a ${Math.round(min / 60)} h` : `le ${new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
};
const PREMIERS = 3;

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
  const { recherches, offres, chargement, recharger } = useRecherchesDrive(requete);
  const { recharger: rechargerProduits } = useProducts();
  const [envoi, setEnvoi] = useState(false), [erreur, setErreur] = useState<string | null>(null);
  const [coches, setCoches] = useState<string[]>([]), [ouverts, setOuverts] = useState<Partial<Record<DriveRecherche, boolean>>>({});
  const [comparer, setComparer] = useState(false), [garde, setGarde] = useState<string | null>(null), [lot, setLot] = useState(false);
  const etape = phase(recherches, offres), dernieres = dernieresParDrive(recherches);
  useEffect(() => { if (!chargement) onPhase?.(etape); }, [etape, chargement]);

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

  if (chargement) return null;
  const pied = !!erreur && <Text accessibilityLiveRegion="polite" style={[ui.error, s.marge]}>{erreur}</Text>;

  if (etape === 'aucune') return <View style={s.bloc}>
    <View style={s.encart}>
      <View style={s.ligneIcone}>
        <Feather name="monitor" size={20} color={colors.accent} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.titre}>Pas le bon produit ?</Text>
          <Text style={s.texte}>L’extension le cherchera sur tes drives, depuis Chrome sur l’ordinateur. Les résultats reviendront ici.</Text>
        </View>
      </View>
      <Pressable accessibilityRole="button" disabled={envoi} onPress={() => { void demander(); }} style={({ pressed }) => [s.principal, (pressed || envoi) && { opacity: .85 }]}>
        {envoi ? <ActivityIndicator color={colors.accentContrast} /> : <Text style={s.principalTexte}>Chercher sur Carrefour et E.Leclerc</Text>}
      </Pressable>
    </View>
    {pied}
  </View>;

  const etats = <View style={{ gap: 6 }}>
    {DRIVES_RECHERCHE.map(d => <View key={d} style={s.etat}><Text style={s.etatDrive}>{NOMS_DRIVE[d]}</Text><Text style={s.etatTexte}>{libelleStatut(dernieres[d])}</Text></View>)}
  </View>;

  if (etape !== 'resultats') return <View style={s.bloc}>
    <View style={s.carte}>
      <View style={s.ligneIcone}>
        <View style={s.rond}><Feather name={etape === 'attente' ? 'clock' : 'search'} size={20} color={colors.accent} /></View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.titre}>{etape === 'attente' ? 'Recherche envoyée' : 'Rien trouvé sur les drives'}</Text>
          <Text style={s.texte}>{etape === 'attente'
            ? 'L’extension la fera depuis Chrome, sur l’ordinateur : son état s’affiche en bas. Les résultats reviendront ici, même si tu passes au point suivant.'
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
        <Text style={s.titrePetit}>{lot ? 'Les autres sont envoyés aussi' : `Les ${autres.length} autres aussi ?`}</Text>
        <Text style={s.texte}>{lot ? 'Ils seront cherchés dans la même séance.' : 'Une seule séance de recherche sur l’ordinateur.'}</Text>
      </View>
      {!lot && <Pressable accessibilityRole="button" accessibilityLabel={`Chercher aussi les ${autres.length} autres points sur les drives`} disabled={envoi} onPress={() => { void toutEnvoyer(); }} style={({ pressed }) => [s.secondaire, pressed && { opacity: .8 }]}>
        <Text style={s.secondaireTexte}>Tout envoyer</Text>
      </Pressable>}
    </View>}
    {pied}
  </View>;

  const cochees = offres.filter(o => coches.includes(o.id));
  return <View style={s.bloc}>
    <View style={s.entete}>
      <Text style={s.section}>Sur tes drives</Text>
      {cochees.length >= 2 && <Pressable accessibilityRole="button" accessibilityLabel={`Comparer les ${cochees.length} produits cochés`} onPress={() => setComparer(true)} style={({ pressed }) => [s.comparer, pressed && { opacity: .8 }]}>
        <Feather name="columns" size={15} color={colors.accent} /><Text style={s.comparerTexte}>Comparer · {cochees.length}</Text>
      </Pressable>}
    </View>
    {DRIVES_RECHERCHE.map(d => {
      const liste = offresDuDrive(offres, d), r = dernieres[d], tout = ouverts[d] || liste.length <= PREMIERS + 1;
      return <View key={d} style={{ gap: 6 }}>
        <View style={s.sousEntete}>
          <Text style={s.drive}>{NOMS_DRIVE[d].toUpperCase()}</Text>
          <Text style={s.quand}>{r && !estEnAttente(r.statut) && liste.length ? ilYa(r.faite_le) : libelleStatut(r)}</Text>
        </View>
        {liste.length > 0 && <View style={s.liste}>
          {(tout ? liste : liste.slice(0, PREMIERS)).map((o, i, vus) => {
            const coche = coches.includes(o.id), detail = [contenance(o), prixLisible(o.prix), prixLisible(o.prix_unitaire, o.unite_prix), o.promotion, o.disponible ? null : 'indisponible'].filter(Boolean).join(' · ');
            return <View key={o.id} style={[s.offre, (i < vus.length - 1 || !tout) && s.separee]}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: coche }} accessibilityLabel={`Comparer ${o.libelle}`} onPress={() => cocher(o.id)} hitSlop={6} style={s.case}>
                <View style={[s.boite, coche && s.boiteCochee]}>{coche && <Feather name="check" size={14} color={colors.accentContrast} />}</View>
              </Pressable>
              <Photo name={o.libelle} url={o.image_url} style={s.photo} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={ui.productName} numberOfLines={2}>{o.libelle}</Text>
                {!!detail && <Text style={[ui.detail, { marginTop: 0 }]} numberOfLines={1}>{detail}</Text>}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Choisir ${o.libelle}, sur ${NOMS_DRIVE[d]}`} disabled={!!garde} onPress={() => { void garder([o]); }} style={s.plus}>
                {garde === o.id ? <ActivityIndicator size="small" color={colors.accent} /> : <Feather name="plus" size={18} color={colors.accent} />}
              </Pressable>
            </View>;
          })}
          {!tout && <Pressable accessibilityRole="button" onPress={() => setOuverts(x => ({ ...x, [d]: true }))} style={s.voir}><Text style={ui.link}>Voir les {liste.length - PREMIERS} autres</Text></Pressable>}
        </View>}
      </View>;
    })}
    <Text style={[s.texte, s.marge]}>Coche-en deux ou plus pour les comparer. Le produit gardé rejoint « Mes produits », déjà relié à son drive.</Text>
    {pied}
    <ComparerOffres visible={comparer} offres={cochees} occupe={!!garde} onFermer={() => setComparer(false)} onGarder={o => { void garder(o); }} />
  </View>;
}

/**
 * Le comparatif des offres cochées (CD 3 bis) : le tableau de l'ordre d'essai,
 * au plus un choix par drive. Il s'adapte au produit : la contenance lue dans
 * le libellé (mètres, feuilles, lavages, grammes…) et le prix ramené à cette
 * mesure ; les fiches Open Food, Beauty et Products Facts des codes-barres
 * connus ajoutent Nutri-Score, NOVA et repères. Quelques phrases en tirent
 * l'essentiel. À deux, chaque panier prendra celui de son drive.
 */
function ComparerOffres({ visible, offres, occupe, onFermer, onGarder }: {
  visible: boolean; offres: OffreRelevee[]; occupe: boolean; onFermer: () => void; onGarder: (o: OffreRelevee[]) => void;
}) {
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
      void lookupEan(o.ean13).then(r => { if (actif) setFiches(f => ({ ...f, [o.id]: r.etat === 'trouve' ? r.fiche : null })); });
    }
    return () => { actif = false; };
  }, [visible, cles]);
  const attente = offres.some(o => !(o.id in fiches));

  const choisies = offres.filter(o => choix[o.drive] === o.id);
  // Les mesures : le libellé d'abord, puis le relevé du drive et la fiche ouverte pour le poids ou le volume.
  const mesures: Mesures[] = offres.map(o => {
    const m = lireMesures(o.libelle), f = fiches[o.id];
    const g = m.g ?? o.grammage_g ?? f?.grammageG ?? null, ml = m.ml ?? o.volume_ml ?? f?.volumeMl ?? null;
    return { ...m, ...(g ? { g: Number(g) } : {}), ...(ml ? { ml: Number(ml) } : {}) };
  });
  const unite = uniteCommune(mesures);
  const parUnite = offres.map((o, i) => (unite ? prixParUnite(o.prix, mesures[i], unite) : null));
  const colonnes = offres.map(o => { const f = fiches[o.id];
    return { ean13: o.id, name: o.libelle, brand: o.marque, imageUrl: o.image_url ?? f?.imageUrl ?? null, grammageG: o.grammage_g, volumeMl: o.volume_ml,
      productType: null, categoryKey: null, nutriscore: o.nutriscore ?? f?.nutriscore ?? null, ...(f?.details ? { details: f.details } : {}) }; });
  const phrases = analyser(offres.map((o, i) => ({ nom: o.libelle, prix: o.prix, prixUnite: parUnite[i], nutriscore: colonnes[i].nutriscore,
    nova: fiches[o.id]?.details?.nova ?? null, promotion: o.promotion, disponible: o.disponible })), unite);
  const contenance = (m: Mesures) => {
    const u = unite && m[unite] != null ? unite : ORDRE_UNITES.find(x => m[x] != null);
    return u ? contenanceLisible(u, m[u]!) : '—';
  };
  const sources = offres.map(o => fiches[o.id]?.origine ?? (fiches[o.id] ? 'Open Food Facts' : null));
  const avant: LigneComparatif[] = [
    ['drive', 'Drive', (_, i) => <Text style={s.pastille}>{NOMS_DRIVE[offres[i].drive]}</Text>],
    ['prix', 'Prix au drive', (_, i) => offres[i].prix != null
      ? <><Text style={s.prix}>{prixLisible(offres[i].prix)}</Text><Text style={s.date}>{ilYa(offres[i].vu_le)}</Text></>
      : <Text style={s.cellule}>—</Text>],
    // Une ligne vide pour tous n'apprend rien : contenance, prix à la mesure, promo, dispo et fiche n'apparaissent que si l'un en a.
    ...(mesures.some(m => Object.keys(m).length) ? [['contenance', 'Contenance', (_, i) => <Text style={s.cellule}>{contenance(mesures[i])}</Text>] as LigneComparatif] : []),
    ...(unite ? [['unite', libellePrixUnitaire(unite), (_, i) => <Text style={s.cellule}>{parUnite[i] != null ? prixUnitaireLisible(parUnite[i]!, unite) : '—'}</Text>] as LigneComparatif] : []),
    ...(offres.some(o => o.promotion) ? [['promo', 'Promo', (_, i) => <Text style={[s.cellule, !!offres[i].promotion && { color: colors.attentionText, fontWeight: '700' }]}>{offres[i].promotion ?? '—'}</Text>] as LigneComparatif] : []),
    ...(offres.some(o => !o.disponible) ? [['dispo', 'Dispo', (_, i) => <Text style={s.cellule}>{offres[i].disponible ? 'en stock' : 'indisponible'}</Text>] as LigneComparatif] : []),
    ...(sources.some(Boolean) ? [['fiche', 'Fiche', (_, i) => <Text style={[s.cellule, { fontSize: 11 }]}>{sources[i] ?? '—'}</Text>] as LigneComparatif] : []),
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
        <View style={[s.bouton, { alignItems: 'flex-end' }]}>{attente && <ActivityIndicator color={colors.accent} />}</View>
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 24, gap: 14 }}>
        {phrases.length > 0 && <View style={s.analyse} accessibilityLiveRegion="polite">
          <Text style={s.analyseTitre}>Ce qu’on peut en dire</Text>
          {phrases.map(p => <View key={p} style={s.puce}><View style={s.point} /><Text style={s.analyseTexte}>{p}</Text></View>)}
        </View>}
        <Text style={[s.texte, { paddingHorizontal: 16 }]}>Choisis un produit par drive, ou un seul pour les deux.</Text>
        <TableauComparatif colonnes={colonnes} avant={avant} meilleursAvant={{ unite: plusPetits(parUnite), prix: plusPetits(offres.map(o => o.prix)) }} enAvant={offres.flatMap((o, i) => choix[o.drive] === o.id ? [i] : [])}
          pied={(_, i) => { const o = offres[i], pris = choix[o.drive] === o.id;
            return <Pressable accessibilityRole="button" accessibilityState={{ selected: pris }} accessibilityLabel={`${pris ? 'Retirer le choix de' : 'Choisir'} ${o.libelle} pour ${NOMS_DRIVE[o.drive]}`}
              onPress={() => setChoix(c => basculerChoix(c, o))} style={[s.choisir, pris && s.choisi]}>
              <Text style={[s.choisirTexte, pris && { color: colors.accentContrast }]}>{pris ? 'Choisi' : 'Choisir'}</Text>
            </Pressable>; }} />
        <Text style={[s.texte, { textAlign: 'center', paddingHorizontal: 16 }]}>Le meilleur de chaque ligne en vert. Un 2ᵉ choix sur le même drive remplace le 1er.</Text>
      </ScrollView>
      <View style={s.validation}>
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
  secondaire: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  secondaireTexte: { fontSize: 14, fontWeight: '600', color: colors.accent },
  etat: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.bg, gap: 8 },
  etatDrive: { fontSize: 14, fontWeight: '600', color: colors.text },
  etatTexte: { fontSize: 13, color: colors.textMuted, flexShrink: 1, textAlign: 'right' },
  lien: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  lienDiscret: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 },
  section: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  comparer: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.accentSoft },
  comparerTexte: { fontSize: 14, fontWeight: '600', color: colors.accent },
  sousEntete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 4 },
  drive: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: colors.textMuted },
  quand: { fontSize: 12, color: colors.textMuted },
  liste: { backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' },
  offre: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 4, paddingRight: 10 },
  separee: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  case: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  boite: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.traitControle, alignItems: 'center', justifyContent: 'center' },
  boiteCochee: { backgroundColor: colors.accent, borderColor: colors.accent },
  photo: { width: 44, height: 44, borderRadius: 8 },
  plus: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
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
  choisir: { alignSelf: 'stretch', minHeight: 40, paddingHorizontal: 6, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  choisi: { backgroundColor: colors.accent },
  choisirTexte: { fontSize: 13, fontWeight: '700', color: colors.accent },
  validation: { backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 8 },
  resume: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  resumeTexte: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '600', color: colors.text },
  analyse: { marginHorizontal: 16, backgroundColor: colors.accentSoft, borderRadius: 14, padding: 14, gap: 8 },
  analyseTitre: { fontSize: 14, fontWeight: '700', color: colors.text },
  puce: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  point: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginTop: 7 },
  analyseTexte: { flex: 1, fontSize: 14, lineHeight: 20, color: '#3C4A34' },
});
