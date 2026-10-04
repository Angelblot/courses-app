import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { type Product } from '../stores/products';
import { useDerniersPrix } from '../stores/historique';
import { quandAchete } from '../lib/historique-prix';
import { useMaison } from '../contexts/useMaison';
import { classement, references } from '../lib/references';
import { ouvrirFiche } from '../components/FicheAppuiLong';
import { MenuProduit } from '../components/MenuProduit';
import { Action, Head, Photo, ui, useAnnulation, EspaceBas } from '../components/MaisonUI';
import { RAYONS, rayonDepuisLibelle, type CleRayon } from '../lib/rayons';
import { colors } from '../lib/theme';

const sansCadreWeb = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;
const contenance = (p: Product) => p.volume_ml ? (p.volume_ml >= 1000 ? `${String(p.volume_ml / 1000).replace('.', ',')} L` : `${p.volume_ml} ml`) : p.grammage_g ? `${p.grammage_g} g` : p.brand ?? '';
const ENSEIGNES: Record<string, string> = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' };
const euros = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;

/**
 * Mes produits (variante MP2) : le catalogue des références, rangé par rayon.
 * Une ligne par produit : photo, nom, contenance, nombre de choix quand des
 * alternatives prennent le relais, et à droite le dernier prix payé et où.
 * Une coche verte sur la photo : il est dans la liste en cours. Les puces
 * sautent d'un rayon à l'autre et suivent le défilement ; glisser la liste
 * vers la gauche ou la droite passe au rayon suivant ou précédent. Un appui long ouvre
 * le menu contextuel natif d'iOS : liste, modifier, actualiser, supprimer.
 */
export default function Favoris() {
  const { p, w, acheter } = useMaison(), { width } = useWindowDimensions(), derniers = useDerniersPrix();
  const [query, setQuery] = useState(''), [actif, setActif] = useState<CleRayon | null>(null);
  const annulation = useAnnulation();
  useFocusEffect(useCallback(() => { void derniers.recharger(); }, [derniers.recharger]));
  const refs = references(p.produits);
  const q = query.trim().toLocaleLowerCase('fr');
  const dansListe = new Set(acheter.map(l => l.product_id).filter(Boolean));
  const sections = RAYONS.map(r => ({ ...r, produits: refs
    .filter(x => rayonDepuisLibelle(x.category) === r.cle && (!q || `${x.name} ${x.brand ?? ''}`.toLocaleLowerCase('fr').includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr')) })).filter(r => r.produits.length);
  const largeurLigne = Math.min(width, 720) - 32;
  const retour = () => { if (router.canGoBack()) router.back(); else router.dismissTo('/compte'); };

  // Les puces sautent au rayon ; au défilement, celle du rayon visible s'allume.
  const defilement = useRef<ScrollView>(null), rangee = useRef<ScrollView>(null);
  const posSections = useRef<Partial<Record<CleRayon, number>>>({}), posPuces = useRef<Partial<Record<CleRayon, number>>>({}), hautBarre = useRef(0), debutListe = useRef(0), sautJusqua = useRef(0);
  const montrerPuce = (cle: CleRayon) => { const x = posPuces.current[cle]; if (x != null) rangee.current?.scrollTo({ x: Math.max(0, x - 16), animated: true }); };
  const allerA = (cle: CleRayon) => {
    const y = posSections.current[cle];
    if (y == null) return;
    void Haptics.selectionAsync().catch(() => {});
    // Pendant le saut, le défilement ne doit pas rallumer la puce d'avant.
    sautJusqua.current = Date.now() + 700; setActif(cle); montrerPuce(cle);
    defilement.current?.scrollTo({ y: Math.max(0, debutListe.current + y - hautBarre.current - 4), animated: true });
  };
  const suivre = (y: number) => {
    if (Date.now() < sautJusqua.current) return;
    const repere = y + hautBarre.current + 12 - debutListe.current;
    let courant: CleRayon | null = sections[0]?.cle ?? null;
    for (const r of sections) { const pos = posSections.current[r.cle]; if (pos != null && pos <= repere) courant = r.cle; }
    if (courant && courant !== actif) { setActif(courant); montrerPuce(courant); }
  };

  const voisin = (sens: 1 | -1) => {
    const i = sections.findIndex(r => r.cle === (actif ?? sections[0]?.cle)), j = i + sens;
    if (i >= 0 && j >= 0 && j < sections.length) allerA(sections[j].cle);
  };
  const voisinRef = useRef(voisin), finBalayage = useRef(0); voisinRef.current = voisin;
  const balayage = useMemo(() => Gesture.Pan().runOnJS(true).activeOffsetX([-24, 24]).failOffsetY([-14, 14])
    // Le relâché d'un glissement ne doit pas ouvrir la fiche sous le doigt.
    .onEnd(e => { finBalayage.current = Date.now(); if (Math.abs(e.translationX) > 60 || Math.abs(e.velocityX) > 600) voisinRef.current(e.translationX < 0 ? 1 : -1); }), []);

  const ouvrir = ouvrirFiche;
  const ajouterListe = (x: Product) => { const avant = w.quotidien[x.id] ?? null; w.ajouterProduitListe(x.id); annulation.proposer(`${x.name} ajouté à ta liste`, () => w.marquerProduit(x.id, avant)); };
  const ligne = (x: Product, derniere: boolean) => {
    const choix = classement(x, p.produits).length, prix = derniers.prix.get(x.id), liste = dansListe.has(x.id), poids = contenance(x);
    const detail = [poids, choix > 1 ? `${choix} choix` : ''].filter(Boolean).join(', ');
    return <Pressable accessibilityRole="button" accessibilityLabel={`Consulter ${x.name}${detail ? `, ${detail}` : ''}${prix ? `, dernier prix ${euros(prix.prix)} chez ${ENSEIGNES[prix.drive] ?? prix.drive}, ${quandAchete(prix.jour)}` : ', jamais acheté'}${liste ? ', dans ta liste' : ''}`}
      accessibilityHint="Appui long pour plus d’actions" onPress={() => { if (Date.now() - finBalayage.current > 400) ouvrir(x); }} onLongPress={Platform.OS === 'ios' ? undefined : () => ouvrir(x)}
      style={({ pressed }) => [s.ligne, { width: largeurLigne }, !derniere && s.separee, pressed && { backgroundColor: colors.bg }]}>
      <View style={s.photo}>
        <Photo name={x.name} url={x.image_url} style={s.image} />
        {liste && <View style={s.coche}><Feather name="check" size={12} color="#FFFFFF" /></View>}
      </View>
      <View style={s.milieu}>
        <Text style={s.nom} numberOfLines={2}>{x.name}</Text>
        {(!!poids || choix > 1) && <Text style={s.detail} numberOfLines={1}>{poids}{poids && choix > 1 ? ' · ' : ''}{choix > 1 && <Text style={s.choix}>{choix} choix</Text>}</Text>}
      </View>
      <View style={s.prix}>
        {prix ? <><Text style={s.montant}>{euros(prix.prix)}</Text><Text style={s.ou} numberOfLines={1}>{ENSEIGNES[prix.drive] ?? prix.drive} · {quandAchete(prix.jour)}</Text></>
          : <Text style={s.jamais}>Jamais acheté</Text>}
      </View>
    </Pressable>;
  };

  return <SafeAreaView edges={['top']} style={ui.screen}>
    <ScrollView ref={defilement} keyboardShouldPersistTaps="handled" contentContainerStyle={s.corps} stickyHeaderIndices={[1]}
      onScroll={e => suivre(e.nativeEvent.contentOffset.y)} scrollEventThrottle={64}>
      <View style={s.entete}><Head title="Mes produits" back onBack={retour} avatar={false} /></View>
      <View style={s.barre} onLayout={e => { hautBarre.current = e.nativeEvent.layout.height; }}>
        <View style={ui.row}>
          <View style={s.recherche}><Feather name="search" size={18} color={colors.textMuted} /><TextInput accessibilityLabel="Chercher un produit" style={[s.saisie, sansCadreWeb]} placeholder="Chercher un produit…" placeholderTextColor={colors.textMuted} value={query} onChangeText={setQuery} returnKeyType="search" /></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Scanner un produit" onPress={() => router.push('/scan')} style={s.scan}><Feather name="maximize" size={20} color={colors.accent} /></Pressable>
        </View>
        {sections.length > 1 && <ScrollView ref={rangee} horizontal showsHorizontalScrollIndicator={false} style={s.rangeePuces} contentContainerStyle={s.puces}>
          {sections.map(r => { const on = (actif ?? sections[0].cle) === r.cle; return <Pressable key={r.cle} onLayout={e => { posPuces.current[r.cle] = e.nativeEvent.layout.x; }} accessibilityRole="button" accessibilityLabel={`Aller au rayon ${r.label}, ${r.produits.length} produits`} accessibilityState={{ selected: on }} aria-selected={on} onPress={() => allerA(r.cle)} style={[s.puce, on && s.puceActive]}><Text style={[s.puceTexte, on && { color: colors.accentContrast }]}>{r.label}<Text style={[s.puceCompte, on && { color: colors.accentSoft }]}>  {r.produits.length}</Text></Text></Pressable>; })}
        </ScrollView>}
      </View>
      <GestureDetector gesture={balayage}><View onLayout={e => { debutListe.current = e.nativeEvent.layout.y; }}>
        {p.chargement && !p.produits.length && <ActivityIndicator color={colors.accent} />}
        {!!p.erreur && <View style={{ paddingHorizontal: 16, gap: 8 }}><Text style={ui.error}>{p.erreur}</Text><Action secondary onPress={p.recharger}>Réessayer</Action></View>}
        {sections.map(r => <View key={r.cle} onLayout={e => { posSections.current[r.cle] = e.nativeEvent.layout.y; }}>
          <Text style={s.rayon} accessibilityRole="header">{r.label.toUpperCase()} · {r.produits.length}</Text>
          <View style={s.carte}>{r.produits.map((x, i) =>
            <MenuProduit key={x.id} largeur={largeurLigne} onAjouter={() => ajouterListe(x)} onModifier={() => ouvrir(x, 'modifier')}
              onActualiser={x.ean13 ? () => ouvrir(x, 'actualiser') : undefined} onSupprimer={() => ouvrir(x, 'supprimer')}>
              {ligne(x, i === r.produits.length - 1)}
            </MenuProduit>)}</View>
        </View>)}
        {!p.chargement && !p.erreur && !sections.length && <View style={[ui.notice, { marginHorizontal: 16 }]}><Text style={ui.productName}>{query ? 'Aucun produit ne correspond.' : 'Pas encore de produit.'}</Text><Text style={ui.subtitle}>Scanne un produit pour l’ajouter : il rejoindra tes habitudes.</Text></View>}
      </View></GestureDetector>
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
  rayon: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: colors.textMuted, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  carte: { backgroundColor: colors.surface, borderRadius: 16, marginHorizontal: 16, overflow: 'hidden' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface },
  separee: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  photo: { width: 52, height: 52 },
  image: { width: 52, height: 52, borderRadius: 10, backgroundColor: 'white' },
  coche: { position: 'absolute', right: -5, bottom: -5, width: 20, height: 20, borderRadius: 10, backgroundColor: '#2F6B2F', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  milieu: { flex: 1, minWidth: 0, gap: 2 },
  nom: { fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 19 },
  detail: { fontSize: 13, color: colors.textMuted },
  choix: { color: colors.accent, fontWeight: '600' },
  prix: { alignItems: 'flex-end', gap: 1, flexShrink: 0 },
  montant: { fontSize: 15, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  ou: { fontSize: 11, color: colors.textMuted },
  jamais: { fontSize: 12, color: colors.textMuted },
});
