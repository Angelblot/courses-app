import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors } from '../lib/theme';
import { Photo } from './MaisonUI';
import { nomDrive, raison, type LigneResultat } from '../lib/compte-rendu.ts';
import { offresPertinentes, recherchesPlusCourtes, type Remplacement } from '../lib/remplacement.ts';
import { produitsProches } from '../lib/session-courses';
import { formaterContenance } from '../lib/fiche-produit.ts';
import { annulerRecherche, demanderRecherches, garderOffres, useRecherchesDrive } from '../stores/recherches-drive';
import { retenirAlternative, type OffreVueTravail } from '../stores/remplacements';
import type { OffreRelevee } from '../lib/recherche-drive.ts';
import type { Product } from '../stores/products';

const euros = (n: number | null | undefined) => n == null ? null : `${n.toFixed(2).replace('.', ',')} €`;
const parUnite = (o: OffreRelevee) => o.prix_unitaire == null ? null
  : `${o.prix_unitaire.toFixed(2).replace('.', ',')} €/${o.unite_prix === 'l' ? 'L' : o.unite_prix === 'kg' ? 'kg' : 'u'}`;

/**
 * Remplacer un produit non ajouté (maquette « Remplacer un produit non
 * ajouté ») : les offres vues par l'extension pendant le remplissage, tes
 * produits proches, et, si rien ne convient, une recherche plus courte sur
 * le drive dont les résultats arrivent en direct.
 */
export function RemplacerSheet({ visible, onFermer, drive, drives, ligne, offresVues, recherches, produits, origineId, actuel, onChoisi, onRetirer }: {
  visible: boolean; onFermer: () => void; drive: string; drives: string[]; ligne: LigneResultat | null;
  offresVues: OffreVueTravail[]; recherches: string[]; produits: Product[]; origineId: string | null;
  /** Le remplacement déjà choisi pour cette ligne : « Changer » part de lui. */
  actuel?: Remplacement;
  onChoisi: (r: Remplacement) => void; onRetirer: () => void;
}) {
  const insets = useSafeAreaInsets();
  const nom = ligne?.item ?? '';
  const [choix, setChoix] = useState<string | null>(null), [requete, setRequete] = useState(''), [libre, setLibre] = useState('');
  const [chercher, setChercher] = useState(false), [occupe, setOccupe] = useState(false), [erreur, setErreur] = useState<string | null>(null);
  const [depuis, setDepuis] = useState(0), [maintenant, setMaintenant] = useState(Date.now());
  const defile = useRef<ScrollView>(null), yResultats = useRef(0);
  useEffect(() => { if (visible) { setChoix(actuel ? `p:${actuel.product_id}` : null); setRequete(''); setLibre(''); setChercher(false); setErreur(null); } }, [visible, nom]);

  const vues = useMemo(() => offresPertinentes(offresVues, nom, drive, recherches), [offresVues, nom, drive, recherches]);
  // Le remplacement actuel figure en tête de tes produits, coché.
  const proches = useMemo(() => {
    const liste = produitsProches(nom, produits.filter(p => p.id !== origineId && p.id !== actuel?.product_id), 4);
    const a = actuel && produits.find(p => p.id === actuel.product_id);
    return a ? [a, ...liste] : liste;
  }, [nom, produits, origineId, actuel]);
  const courtes = useMemo(() => recherchesPlusCourtes(nom), [nom]);
  const { recherches: lancees, offres: trouvees } = useRecherchesDrive(requete);
  const enCours = lancees.some(r => r.drive === drive && ['en_attente', 'en_cours'].includes(r.statut));
  const pasPrise = lancees.some(r => r.drive === drive && r.statut === 'en_attente');
  useEffect(() => { if (!enCours) return; const t = setInterval(() => setMaintenant(Date.now()), 5000); return () => clearInterval(t); }, [enCours]);
  // Extension éteinte : la recherche attend sans fin ; au bout d'une minute, on le dit.
  const enAttenteLongue = pasPrise && maintenant - depuis > 60_000;
  const nouvelles = trouvees.filter(o => o.drive === drive && !vues.some(v => v.libelle === o.libelle));
  const voirRecherche = chercher || !vues.length;

  const lancer = async (q: string) => {
    const t = q.trim(); if (!t) return;
    Keyboard.dismiss();
    setRequete(t); setChoix(null); setErreur(null); setDepuis(Date.now()); setMaintenant(Date.now());
    setTimeout(() => defile.current?.scrollTo({ y: Math.max(0, yResultats.current - 12), animated: true }), 150);
    const res = await demanderRecherches([{ requete: t, drives: [drive as 'carrefour' | 'leclerc'] }], { siAbsente: true });
    if (!res.ok) setErreur(res.erreur ?? 'Impossible de lancer la recherche. Réessaie.');
  };

  const offreChoisie = choix?.startsWith('o:') ? [...vues, ...nouvelles].find(o => `o:${o.id}` === choix) : undefined;
  const produitChoisi = choix?.startsWith('p:') ? proches.find(p => `p:${p.id}` === choix) : undefined;
  const prixChoisi = offreChoisie ? euros(offreChoisie.prix) : null;

  async function valider() {
    if (occupe || (!offreChoisie && !produitChoisi)) return;
    setOccupe(true); setErreur(null);
    try {
      let r: Remplacement;
      if (offreChoisie) {
        // Une offre déjà gardée (même libellé dans tes produits) est réutilisée : pas de doublon.
        const deja = produits.find(p => p.name.trim().toLowerCase() === offreChoisie.libelle.trim().toLowerCase() || (!!offreChoisie.ean13 && p.ean13 === offreChoisie.ean13));
        const g = await garderOffres([deja ? { ...offreChoisie, produit_id: deja.id } : offreChoisie], nom);
        if (!g.ok || !g.productId) { setErreur(g.erreur ?? 'Impossible de garder ce produit. Réessaie.'); return; }
        r = { product_id: g.productId, nom: offreChoisie.libelle, ean13: offreChoisie.ean13, prix: offreChoisie.prix, image_url: offreChoisie.image_url,
          grammage_g: offreChoisie.grammage_g, volume_ml: offreChoisie.volume_ml, category: null };
      } else {
        const p = produitChoisi!;
        r = { product_id: p.id, nom: p.name, ean13: p.ean13, prix: null, image_url: p.image_url, grammage_g: p.grammage_g, volume_ml: p.volume_ml, category: p.category };
      }
      await retenirAlternative(origineId, r.product_id, actuel && actuel.product_id !== r.product_id ? actuel.product_id : null);
      AccessibilityInfo.announceForAccessibility(`${nom} remplacé par ${r.nom}`);
      onChoisi(r);
    } finally { setOccupe(false); }
  }

  const caseRadio = (on: boolean) => <View style={[s.radio, on && s.radioOn]}>{on && <Feather name="check" size={14} color={colors.accentContrast} />}</View>;
  const rangeeOffre = (o: OffreRelevee) => {
    const on = choix === `o:${o.id}`, prix = euros(o.prix), unite = parUnite(o);
    return <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on}
      accessibilityLabel={`${o.libelle}${prix ? `, ${prix}` : ''}${unite ? `, ${unite}` : ''}${o.promotion ? `, ${o.promotion}` : ''}`}
      onPress={() => setChoix(on ? null : `o:${o.id}`)} style={[s.option, on && s.optionOn]}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><Photo name={o.libelle} url={o.image_url} style={s.photo} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.nomOption} numberOfLines={2}>{o.libelle}</Text>
        <View style={s.prixLigne}>
          {prix && <Text style={s.prix}>{prix}</Text>}
          {unite && <Text style={s.detail}>{prix ? '· ' : ''}{unite}</Text>}
          {!!o.promotion && <View style={s.badge}><Text style={s.badgeTexte} numberOfLines={1}>{o.promotion}</Text></View>}
        </View>
      </View>
      {caseRadio(on)}
    </Pressable>;
  };
  const r = ligne ? raison(ligne, drive, drives) : null;

  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFermer}>
    <SafeAreaView style={s.ecran} edges={['top']}>
      <ScrollView ref={defile} contentContainerStyle={s.corps} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
        <View style={s.tete}>
          <View style={{ flex: 1 }}>
            <Text style={s.sur}>Remplacer sur {nomDrive(drive)}</Text>
            <Text accessibilityRole="header" style={s.titre}>« {nom} »</Text>
            {r && <View style={[s.pastille, { backgroundColor: r.ton === 'danger' ? colors.dangerSoft : r.ton === 'attention' ? colors.attentionSoft : colors.off }]}>
              <Text style={[s.pastilleTexte, { color: r.ton === 'danger' ? colors.danger : r.ton === 'attention' ? colors.attentionText : colors.textMuted }]}>{r.libelle}</Text></View>}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onFermer} hitSlop={8} style={s.fermer}><Feather name="x" size={18} color={colors.textMuted} /></Pressable>
        </View>

        {vues.length > 0 && <>
          <View style={s.sectionBloc}><Text style={s.sectionTitre}>VUS PAR L’EXTENSION SUR {nomDrive(drive).toUpperCase()}</Text><Text style={s.sectionSous}>pendant le remplissage</Text></View>
          <View accessibilityRole="radiogroup" accessibilityLabel={`Vus par l’extension sur ${nomDrive(drive)}`} style={s.groupe}>{vues.slice(0, 8).map(rangeeOffre)}</View>
          {!chercher && <Pressable accessibilityRole="button" onPress={() => setChercher(true)} style={s.lienCentre}><Text style={s.lien}>Chercher autrement sur {nomDrive(drive)}</Text></Pressable>}
        </>}

        {voirRecherche && <>
          {!vues.length && <View style={s.carteInfo}>
            <Feather name="search" size={20} color={colors.attentionText} />
            <View style={{ flex: 1 }}>
              <Text style={s.nomOption}>Rien de convaincant sur la page vue</Text>
              <Text style={[s.detail, { marginTop: 3, lineHeight: 18 }]}>L’extension a cherché « {nom} » sans trouver ce produit. Cherche autrement :</Text>
            </View>
          </View>}
          <View style={s.puces}>
            {courtes.map(q => {
              const on = requete === q;
              return <Pressable key={q} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { void lancer(q); }} style={[s.puce, on && s.puceOn]}>
                <Text style={[s.puceTexte, on && { color: colors.accentContrast }]}>« {q} »</Text>
              </Pressable>;
            })}
          </View>
          <View style={s.champLigne}>
            <TextInput value={libre} onChangeText={setLibre} placeholder="Autre recherche…" returnKeyType="search" onSubmitEditing={() => { void lancer(libre); }} autoCorrect={false}
              accessibilityLabel={`Chercher autre chose sur ${nomDrive(drive)}`} style={s.champ} placeholderTextColor={colors.textMuted} />
            <Pressable accessibilityRole="button" accessibilityLabel="Chercher" disabled={!libre.trim()} onPress={() => { void lancer(libre); }} style={[s.chercher, !libre.trim() && { opacity: .4 }]}>
              <Feather name="search" size={18} color={colors.accentContrast} />
            </Pressable>
          </View>
          {!!requete && <>
            <View style={s.section} onLayout={e => { yResultats.current = e.nativeEvent.layout.y; }}><Text style={s.sectionTitre}>{enCours ? `RECHERCHE EN COURS SUR ${nomDrive(drive).toUpperCase()}` : `« ${requete.toUpperCase()} » SUR ${nomDrive(drive).toUpperCase()}`}</Text></View>
            {enCours && !nouvelles.length && <View style={s.carteInfo} accessibilityLiveRegion="polite">
              {enAttenteLongue ? <Feather name="monitor" size={20} color={colors.attentionText} /> : <ActivityIndicator color={colors.accent} />}
              <View style={{ flex: 1 }}>
                <Text style={s.nomOption}>{enAttenteLongue ? 'L’extension n’a pas encore pris la recherche' : `L’extension cherche « ${requete} »`}</Text>
                <Text style={[s.detail, { marginTop: 2 }]}>{enAttenteLongue ? 'Ouvre Chrome sur ton ordinateur : les produits arriveront ici.' : 'Les produits s’affichent ici dès qu’ils arrivent, en général en moins d’une minute, Chrome ouvert.'}</Text>
                <Pressable accessibilityRole="button" onPress={() => { void annulerRecherche(requete); setRequete(''); }} style={s.annuler}><Text style={s.lienPetit}>Annuler la recherche</Text></Pressable>
              </View>
            </View>}
            {nouvelles.length > 0 && <View accessibilityRole="radiogroup" accessibilityLabel={`Résultats pour ${requete}`} style={s.groupe}>{nouvelles.slice(0, 10).map(rangeeOffre)}</View>}
            {!enCours && !nouvelles.length && lancees.some(x => x.drive === drive) && <Text style={s.detail}>Aucun produit trouvé pour « {requete} ». Essaie une autre recherche.</Text>}
          </>}
        </>}

        {proches.length > 0 && <>
          <View style={s.section}><Text style={s.sectionTitre}>TES PRODUITS</Text><Text style={s.sectionSous}>déjà dans l’app</Text></View>
          <View accessibilityRole="radiogroup" accessibilityLabel="Tes produits" style={s.groupe}>
          {proches.map(p => {
            const on = choix === `p:${p.id}`, detail = [p.brand, formaterContenance(p)].filter(Boolean).join(' · ');
            return <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={`${p.name}${detail ? `, ${detail}` : ''}`}
              onPress={() => setChoix(on ? null : `p:${p.id}`)} style={[s.option, on && s.optionOn]}>
              <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><Photo name={p.name} url={p.image_url} style={s.photo} /></View>
              <View style={{ flex: 1 }}><Text style={s.nomOption} numberOfLines={2}>{p.name}</Text>{!!detail && <Text style={[s.detail, { marginTop: 3 }]} numberOfLines={1}>{detail}</Text>}</View>
              {caseRadio(on)}
            </Pressable>;
          })}
          </View>
        </>}
      </ScrollView>
      <View style={[s.pied, { paddingBottom: Math.max(16, insets.bottom + 4) }]}>
        {!!erreur && <Text accessibilityLiveRegion="polite" style={s.erreur}>{erreur}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel={occupe ? 'Remplacement en cours' : undefined} disabled={!choix || occupe} accessibilityState={{ disabled: !choix || occupe }} onPress={() => { void valider(); }}
          style={[s.valider, (!choix || occupe) && s.validerOff]}>
          {occupe ? <ActivityIndicator color={colors.accentContrast} />
            : <Text style={[s.validerTexte, !choix && { color: colors.offText }]}>{!choix ? 'Choisis un produit' : `Choisir ce produit${prixChoisi ? ` · ${prixChoisi}` : ''}`}</Text>}
        </Pressable>
        {actuel ? <Pressable accessibilityRole="button" onPress={() => { void retenirAlternative(origineId, null, actuel.product_id); onRetirer(); }} style={s.laisser}>
          <Text style={[s.lien, { color: colors.danger }]}>Retirer le remplacement</Text></Pressable>
          : <Pressable accessibilityRole="button" onPress={onFermer} style={s.laisser}><Text style={s.lien}>Laisser sans produit sur {nomDrive(drive)}</Text></Pressable>}
      </View>
    </SafeAreaView>
  </Modal>;
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  corps: { padding: 16, paddingTop: 20, gap: 10, paddingBottom: 24 },
  tete: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sur: { fontSize: 13, color: colors.textMuted },
  titre: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.3, marginTop: 2 },
  pastille: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6 },
  pastilleTexte: { fontSize: 11, fontWeight: '700' },
  fermer: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.off, marginTop: -4 },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8, gap: 8 },
  sectionBloc: { marginTop: 8, gap: 2 },
  groupe: { gap: 10 },
  annuler: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start', marginTop: 4 },
  lienPetit: { fontSize: 13, fontWeight: '600', color: colors.accent },
  sectionTitre: { flexShrink: 1, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: colors.textMuted },
  sectionSous: { fontSize: 12, color: colors.textMuted },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingHorizontal: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1.5, borderColor: colors.surface, minHeight: 64 },
  optionOn: { borderColor: colors.accent },
  photo: { width: 48, height: 48, borderRadius: 10 },
  nomOption: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 18 },
  prixLigne: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  prix: { fontSize: 14, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  detail: { fontSize: 12, color: colors.textMuted },
  badge: { backgroundColor: colors.accentSoft, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 1, maxWidth: 160 },
  badgeTexte: { fontSize: 11, fontWeight: '700', color: colors.accent },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.traitControle, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  lienCentre: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  lien: { fontSize: 15, fontWeight: '600', color: colors.accent },
  carteInfo: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: 12, padding: 14 },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  puce: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.accentSoft, justifyContent: 'center' },
  puceOn: { backgroundColor: colors.accent },
  puceTexte: { fontSize: 14, fontWeight: '600', color: colors.accent },
  champLigne: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  champ: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.traitControle, backgroundColor: colors.surface, paddingHorizontal: 12, fontSize: 16, color: colors.text },
  chercher: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  pied: { padding: 16, gap: 4, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  erreur: { fontSize: 14, color: colors.danger, textAlign: 'center', marginBottom: 6 },
  valider: { minHeight: 50, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  validerOff: { backgroundColor: colors.off },
  validerTexte: { fontSize: 16, fontWeight: '600', color: colors.accentContrast },
  laisser: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
