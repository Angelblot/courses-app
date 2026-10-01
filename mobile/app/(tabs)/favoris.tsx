import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { basculerFavori, useProducts, type Product } from '../../stores/products';
import { useWizard } from '../../contexts/WizardContext';
import { DetailProduit } from '../../components/DetailProduit';
import { Action, Head, Photo, ui, useAnnulation } from '../../components/MaisonUI';
import { RAYONS, rayonDepuisLibelle, type CleRayon } from '../../lib/rayons';
import { colors } from '../../lib/theme';

const sansCadreWeb = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;
type Filtre = 'favoris' | 'tous' | CleRayon;
const contenance = (p: Product) => p.volume_ml ? (p.volume_ml >= 1000 ? `${String(p.volume_ml / 1000).replace('.', ',')} L` : `${p.volume_ml} ml`) : p.grammage_g ? `${p.grammage_g} g` : p.brand ?? '';

/**
 * Mes produits (variante F2) : une grille de photos, l'étoile en coin pour
 * les favoris, des filtres en puces (Favoris, Tous, puis les rayons). Toucher
 * un produit ouvre sa fiche, d'où on l'ajoute à la liste.
 */
export default function Favoris() {
  const p = useProducts(), w = useWizard(), { width } = useWindowDimensions();
  const [query, setQuery] = useState(''), [filtre, setFiltre] = useState<Filtre>('favoris'), [detail, setDetail] = useState<Product | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null), [erreur, setErreur] = useState<string | null>(null);
  const annulation = useAnnulation();
  useFocusEffect(useCallback(() => { p.recharger(); }, [p.recharger]));
  const rayons = RAYONS.filter(r => p.produits.some(x => rayonDepuisLibelle(x.category) === r.cle));
  const q = query.toLocaleLowerCase('fr');
  const produits = p.produits.filter(x => (filtre === 'tous' ? true : filtre === 'favoris' ? x.favorite : rayonDepuisLibelle(x.category) === filtre) && x.name.toLocaleLowerCase('fr').includes(q));
  const colonnes = width >= 700 ? 4 : 2;
  const retour = () => { if (router.canGoBack()) router.back(); else router.replace('/compte'); };
  const etoile = async (x: Product) => {
    if (enCours) return;
    setEnCours(x.id); setErreur(null);
    const r = await basculerFavori(x.id, !x.favorite);
    setEnCours(null);
    if (!r.ok) { setErreur(r.erreur ?? 'Impossible de modifier ce produit.'); return; }
    p.recharger();
  };
  const puces: { cle: Filtre; label: string }[] = [{ cle: 'favoris', label: `Favoris (${p.produits.filter(x => x.favorite).length})` }, { cle: 'tous', label: `Tous (${p.produits.length})` }, ...rayons];

  return <SafeAreaView edges={['top']} style={ui.screen}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.corps} stickyHeaderIndices={[1]}>
      <View style={s.entete}><Head title="Mes produits" back onBack={retour} avatar={false} /></View>
      <View style={s.barre}>
        <View style={ui.row}>
          <View style={s.recherche}><Feather name="search" size={18} color={colors.textMuted} /><TextInput accessibilityLabel="Chercher un produit" style={[s.saisie, sansCadreWeb]} placeholder="Chercher un produit…" placeholderTextColor={colors.textMuted} value={query} onChangeText={setQuery} returnKeyType="search" /></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Scanner un produit" onPress={() => router.push('/scan')} style={s.scan}><Feather name="maximize" size={20} color={colors.accent} /></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.puces}>
          {puces.map(c => { const actif = filtre === c.cle; return <Pressable key={c.cle} accessibilityRole="tab" accessibilityState={{ selected: actif }} aria-selected={actif} onPress={() => setFiltre(c.cle)} style={[s.puce, actif && s.puceActive]}><Text style={[s.puceTexte, actif && { color: colors.accentContrast }]}>{c.label}</Text></Pressable>; })}
        </ScrollView>
      </View>
      {p.chargement && !p.produits.length && <ActivityIndicator color={colors.accent} />}
      {p.erreur && <><Text style={ui.error}>{p.erreur}</Text><Action secondary onPress={p.recharger}>Réessayer</Action></>}
      {!!erreur && <Text accessibilityLiveRegion="polite" style={ui.error}>{erreur}</Text>}
      <View style={s.grille}>{produits.map(x => <View key={x.id} style={[s.tuile, { width: `${100 / colonnes - 2.5}%` }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Consulter ${x.name}${contenance(x) ? `, ${contenance(x)}` : ''}`} onPress={() => setDetail(x)} style={({ pressed }) => pressed && { opacity: .85 }}>
          <View style={s.image}><Photo name={x.name} url={x.image_url} style={s.photo} /></View>
          <View style={s.texte}><Text style={ui.productName} numberOfLines={2}>{x.name}</Text>{!!contenance(x) && <Text style={[ui.detail, { marginTop: 1 }]} numberOfLines={1}>{contenance(x)}</Text>}</View>
        </Pressable>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: x.favorite, busy: enCours === x.id }} aria-checked={x.favorite} accessibilityLabel={`Favori : ${x.name}`} onPress={() => etoile(x)} hitSlop={4} style={s.etoile}>
          <Ionicons name={x.favorite ? 'star' : 'star-outline'} size={18} color={x.favorite ? '#9C7A12' : colors.traitControle} />
        </Pressable>
      </View>)}</View>
      {!p.chargement && !p.erreur && !produits.length && <View style={ui.notice}><Text style={ui.productName}>{query ? 'Aucun produit ne correspond.' : filtre === 'favoris' ? 'Pas encore de favori.' : 'Aucun produit dans ce rayon.'}</Text><Text style={ui.subtitle}>{filtre === 'favoris' && !query ? 'Touche l’étoile d’un produit pour le retrouver dans tes habitudes.' : 'Scanne un produit pour l’ajouter à ton catalogue.'}</Text></View>}
    </ScrollView>
    {annulation.toast}
    <DetailProduit produit={detail ? p.produits.find(x => x.id === detail.id) ?? detail : null} onFermer={() => setDetail(null)} onChange={p.recharger}
      onAjouter={detail ? () => { const avant = w.quotidien[detail.id] ?? null; w.ajouterProduitListe(detail.id); annulation.proposer(`${detail.name} ajouté à ta liste`, () => w.marquerProduit(detail.id, avant)); setDetail(null); } : undefined} />
  </SafeAreaView>;
}

const s = StyleSheet.create({
  corps: { paddingBottom: 40 },
  entete: { paddingHorizontal: 20, paddingTop: 8 },
  barre: { backgroundColor: colors.bg, paddingHorizontal: 16, paddingBottom: 10, gap: 10 },
  recherche: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.traitControle, backgroundColor: colors.surface },
  saisie: { flex: 1, minHeight: 46, fontSize: 16, color: colors.text },
  scan: { width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  puces: { gap: 8 },
  puce: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.traitControle },
  puceActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  puceTexte: { fontSize: 14, fontWeight: '600', color: colors.accent },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  tuile: { backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden' },
  image: { height: 118, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', padding: 8 },
  photo: { width: '100%', height: '100%', borderRadius: 0 },
  texte: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 10, minHeight: 64 },
  etoile: { position: 'absolute', top: 6, right: 6, width: 36, height: 36, borderRadius: 18, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', shadowColor: '#141C10', shadowOpacity: .18, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
 });
