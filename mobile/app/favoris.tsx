import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useProducts, type Product } from '../stores/products';
import { classement, references } from '../lib/references';
import { useWizard } from '../contexts/WizardContext';
import { ouvrirFiche } from '../components/FicheAppuiLong';
import { MenuProduit } from '../components/MenuProduit';
import { Action, Head, Photo, ui, useAnnulation, EspaceBas } from '../components/MaisonUI';
import { RAYONS, rayonDepuisLibelle, type CleRayon } from '../lib/rayons';
import { colors } from '../lib/theme';

const sansCadreWeb = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;
type Filtre = 'tous' | CleRayon;
const contenance = (p: Product) => p.volume_ml ? (p.volume_ml >= 1000 ? `${String(p.volume_ml / 1000).replace('.', ',')} L` : `${p.volume_ml} ml`) : p.grammage_g ? `${p.grammage_g} g` : p.brand ?? '';

/**
 * Mes produits (variante MP1) : la grille des références, toutes des
 * habitudes. Une pastille « +2 » dit combien d'alternatives prendraient le
 * relais ; on les classe sur la fiche. Filtres par rayon en puces. Un appui
 * long ouvre le menu contextuel natif d'iOS : liste, modifier, actualiser,
 * supprimer. Glisser la grille vers la gauche ou la droite passe au rayon
 * suivant ou précédent.
 */
export default function Favoris() {
  const p = useProducts(), w = useWizard(), { width, height } = useWindowDimensions();
  const [query, setQuery] = useState(''), [filtre, setFiltre] = useState<Filtre>('tous');
  const annulation = useAnnulation();
  useFocusEffect(useCallback(() => { p.recharger(); }, [p.recharger]));
  const refs = references(p.produits);
  const rayons = RAYONS.filter(r => refs.some(x => rayonDepuisLibelle(x.category) === r.cle));
  const q = query.toLocaleLowerCase('fr');
  const produits = refs.filter(x => (filtre === 'tous' || rayonDepuisLibelle(x.category) === filtre) && x.name.toLocaleLowerCase('fr').includes(q));
  const colonnes = width >= 700 ? 4 : 2, largeurTuile = Math.floor((width - 32 - 10 * (colonnes - 1)) / colonnes);
  const retour = () => { if (router.canGoBack()) router.back(); else router.dismissTo('/compte'); };

  const puces: { cle: Filtre; label: string; n: number }[] = [
    { cle: 'tous', label: 'Tous', n: refs.length },
    ...rayons.map(r => ({ ...r, n: refs.filter(x => rayonDepuisLibelle(x.category) === r.cle).length })),
  ];
  // Glisser change de rayon ; la grille arrive du côté d'où l'on vient.
  const glisse = useRef(new Animated.Value(0)).current, posPuces = useRef<Record<string, number>>({}), rangee = useRef<ScrollView>(null);
  const [mouvementReduit, setMouvementReduit] = useState(false);
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setMouvementReduit); }, []);
  const changerFiltre = (cle: Filtre, sens = 0) => {
    setFiltre(cle);
    const x = posPuces.current[cle];
    if (x != null) rangee.current?.scrollTo({ x: Math.max(0, x - 16), animated: true });
    if (sens && !mouvementReduit) { glisse.setValue(sens * 40); Animated.timing(glisse, { toValue: 0, duration: 200, useNativeDriver: true }).start(); }
  };
  const voisin = (sens: 1 | -1) => {
    const i = puces.findIndex(c => c.cle === filtre), j = i + sens;
    if (j < 0 || j >= puces.length) return;
    void Haptics.selectionAsync().catch(() => {});
    changerFiltre(puces[j].cle, sens);
  };
  const voisinRef = useRef(voisin); voisinRef.current = voisin;
  const balayage = useMemo(() => Gesture.Pan().runOnJS(true).activeOffsetX([-24, 24]).failOffsetY([-14, 14])
    .onEnd(e => { if (Math.abs(e.translationX) > 60 || Math.abs(e.velocityX) > 600) voisinRef.current(e.translationX < 0 ? 1 : -1); }), []);
  const ouvrir = ouvrirFiche;
  const ajouterListe = (x: Product) => { const avant = w.quotidien[x.id] ?? null; w.ajouterProduitListe(x.id); annulation.proposer(`${x.name} ajouté à ta liste`, () => w.marquerProduit(x.id, avant)); };
  const tuile = (x: Product) => <View style={[s.tuile, { width: largeurTuile }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Consulter ${x.name}${contenance(x) ? `, ${contenance(x)}` : ''}`} accessibilityHint="Appui long pour plus d’actions" onPress={() => ouvrir(x)} onLongPress={Platform.OS === 'ios' ? undefined : () => ouvrir(x)} style={({ pressed }) => pressed && { opacity: .85 }}>
      <View style={s.image}><Photo name={x.name} url={x.image_url} style={s.photo} /></View>
      <View style={s.texte}><Text style={ui.productName} numberOfLines={2}>{x.name}</Text>{!!contenance(x) && <Text style={[ui.detail, { marginTop: 1 }]} numberOfLines={1}>{contenance(x)}</Text>}</View>
    </Pressable>
    {classement(x, p.produits).length > 1 && <Text style={s.alternatives} accessibilityLabel={`${classement(x, p.produits).length - 1} alternatives`}>+{classement(x, p.produits).length - 1}</Text>}
  </View>;

  return <SafeAreaView edges={['top']} style={ui.screen}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.corps} stickyHeaderIndices={[1]}>
      <View style={s.entete}><Head title="Mes produits" back onBack={retour} avatar={false} /></View>
      <View style={s.barre}>
        <View style={ui.row}>
          <View style={s.recherche}><Feather name="search" size={18} color={colors.textMuted} /><TextInput accessibilityLabel="Chercher un produit" style={[s.saisie, sansCadreWeb]} placeholder="Chercher un produit…" placeholderTextColor={colors.textMuted} value={query} onChangeText={setQuery} returnKeyType="search" /></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Scanner un produit" onPress={() => router.push('/scan')} style={s.scan}><Feather name="maximize" size={20} color={colors.accent} /></Pressable>
        </View>
        <ScrollView ref={rangee} horizontal showsHorizontalScrollIndicator={false} style={s.rangeePuces} contentContainerStyle={s.puces}>
          {puces.map(c => { const actif = filtre === c.cle; return <Pressable key={c.cle} onLayout={e => { posPuces.current[c.cle] = e.nativeEvent.layout.x; }} accessibilityRole="tab" accessibilityLabel={`${c.label}, ${c.n}`} accessibilityState={{ selected: actif }} aria-selected={actif} onPress={() => changerFiltre(c.cle)} style={[s.puce, actif && s.puceActive]}><Text style={[s.puceTexte, actif && { color: colors.accentContrast }]}>{c.label}<Text style={[s.puceCompte, actif && { color: colors.accentContrast }]}>  {c.n}</Text></Text></Pressable>; })}
        </ScrollView>
      </View>
      {p.chargement && !p.produits.length && <ActivityIndicator color={colors.accent} />}
      {p.erreur && <><Text style={ui.error}>{p.erreur}</Text><Action secondary onPress={p.recharger}>Réessayer</Action></>}
      <GestureDetector gesture={balayage}><Animated.View style={{ transform: [{ translateX: glisse }], minHeight: Math.max(320, height - 240) }}>
      <View style={s.grille}>{produits.map(x =>
        <MenuProduit key={x.id} largeur={largeurTuile} onAjouter={() => ajouterListe(x)} onModifier={() => ouvrir(x, 'modifier')}
          onActualiser={x.ean13 ? () => ouvrir(x, 'actualiser') : undefined} onSupprimer={() => ouvrir(x, 'supprimer')}>
          {tuile(x)}
        </MenuProduit>)}</View>
      {!p.chargement && !p.erreur && !produits.length && <View style={ui.notice}><Text style={ui.productName}>{query ? 'Aucun produit ne correspond.' : filtre === 'tous' ? 'Pas encore de produit.' : 'Aucun produit dans ce rayon.'}</Text><Text style={ui.subtitle}>Scanne un produit pour l’ajouter : il rejoindra tes habitudes.</Text></View>}
      </Animated.View></GestureDetector>
    <EspaceBas /></ScrollView>
    {annulation.toast}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  corps: { paddingBottom: 40 },
  entete: { paddingHorizontal: 20, paddingTop: 8 },
  barre: { backgroundColor: colors.bg, paddingHorizontal: 16, paddingBottom: 10 },
  recherche: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.traitControle, backgroundColor: colors.surface },
  saisie: { flex: 1, minHeight: 46, fontSize: 16, color: colors.text },
  scan: { width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  rangeePuces: { flexGrow: 0, marginHorizontal: -16, marginTop: 10 },
  puces: { gap: 8, paddingHorizontal: 16 },
  puce: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.traitControle },
  puceActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  puceTexte: { fontSize: 14, fontWeight: '600', color: colors.accent },
  puceCompte: { fontSize: 13, fontWeight: '500', color: colors.textMuted },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  tuile: { backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden' },
  image: { height: 118, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', padding: 8 },
  photo: { width: '100%', height: '100%', borderRadius: 0 },
  texte: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 10, minHeight: 64 },
  alternatives: { position: 'absolute', top: 8, right: 8, fontSize: 12, fontWeight: '700', color: colors.accent, backgroundColor: colors.accentSoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
 });
