import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useProducts, type Product } from '../../stores/products';
import { classement, references } from '../../lib/references';
import { useWizard } from '../../contexts/WizardContext';
import { DetailProduit } from '../../components/DetailProduit';
import { Action, Head, Photo, ui, useAnnulation } from '../../components/MaisonUI';
import { RAYONS, rayonDepuisLibelle, type CleRayon } from '../../lib/rayons';
import { colors } from '../../lib/theme';

const sansCadreWeb = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;
type Filtre = 'tous' | CleRayon;
const contenance = (p: Product) => p.volume_ml ? (p.volume_ml >= 1000 ? `${String(p.volume_ml / 1000).replace('.', ',')} L` : `${p.volume_ml} ml`) : p.grammage_g ? `${p.grammage_g} g` : p.brand ?? '';

/**
 * Mes produits (variante MP1) : la grille des références, toutes des
 * habitudes. Une pastille « +2 » dit combien d'alternatives prendraient le
 * relais ; on les classe sur la fiche. Filtres par rayon en puces.
 */
export default function Favoris() {
  const p = useProducts(), w = useWizard(), { width } = useWindowDimensions();
  const [query, setQuery] = useState(''), [filtre, setFiltre] = useState<Filtre>('tous'), [detail, setDetail] = useState<Product | null>(null);
  const annulation = useAnnulation();
  useFocusEffect(useCallback(() => { p.recharger(); }, [p.recharger]));
  const refs = references(p.produits);
  const rayons = RAYONS.filter(r => refs.some(x => rayonDepuisLibelle(x.category) === r.cle));
  const q = query.toLocaleLowerCase('fr');
  const produits = refs.filter(x => (filtre === 'tous' || rayonDepuisLibelle(x.category) === filtre) && x.name.toLocaleLowerCase('fr').includes(q));
  const colonnes = width >= 700 ? 4 : 2;
  const retour = () => { if (router.canGoBack()) router.back(); else router.replace('/compte'); };

  const puces: { cle: Filtre; label: string }[] = [{ cle: 'tous', label: `Tous (${refs.length})` }, ...rayons];

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
      <View style={s.grille}>{produits.map(x => <View key={x.id} style={[s.tuile, { width: `${100 / colonnes - 2.5}%` }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Consulter ${x.name}${contenance(x) ? `, ${contenance(x)}` : ''}`} onPress={() => setDetail(x)} style={({ pressed }) => pressed && { opacity: .85 }}>
          <View style={s.image}><Photo name={x.name} url={x.image_url} style={s.photo} /></View>
          <View style={s.texte}><Text style={ui.productName} numberOfLines={2}>{x.name}</Text>{!!contenance(x) && <Text style={[ui.detail, { marginTop: 1 }]} numberOfLines={1}>{contenance(x)}</Text>}</View>
        </Pressable>
        {classement(x, p.produits).length > 1 && <Text style={s.alternatives} accessibilityLabel={`${classement(x, p.produits).length - 1} alternatives`}>+{classement(x, p.produits).length - 1}</Text>}
      </View>)}</View>
      {!p.chargement && !p.erreur && !produits.length && <View style={ui.notice}><Text style={ui.productName}>{query ? 'Aucun produit ne correspond.' : filtre === 'tous' ? 'Pas encore de produit.' : 'Aucun produit dans ce rayon.'}</Text><Text style={ui.subtitle}>Scanne un produit pour l’ajouter : il rejoindra tes habitudes.</Text></View>}
    </ScrollView>
    {annulation.toast}
    <DetailProduit produit={detail ? p.produits.find(x => x.id === detail.id) ?? detail : null} produits={p.produits} onFermer={() => setDetail(null)} onChange={p.recharger}
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
  alternatives: { position: 'absolute', top: 8, right: 8, fontSize: 12, fontWeight: '700', color: colors.accent, backgroundColor: colors.accentSoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
 });
