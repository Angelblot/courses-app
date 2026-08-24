import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, SectionList,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ProductRow } from '../../components/ProductRow';
import { DetailProduit } from '../../components/DetailProduit';
import { EtatVide } from '../../components/EtatVide';
import { useProducts, type Product } from '../../stores/products';
import { organiserCatalogue, TRIS, type CleTri } from '../../lib/catalogue.ts';
import { colors, radius, spacing, texte } from '../../lib/theme';

export default function Produits() {
  const { produits, chargement, erreur, recharger } = useProducts();
  const [requete, setRequete] = useState('');
  const [tri, setTri] = useState<CleTri>('rayon');
  const [ouvert, setOuvert] = useState<Product | null>(null);

  // Recharge le catalogue à chaque prise de focus, pas seulement au montage :
  // `<Tabs>` garde les écrans montés d'un onglet à l'autre, si bien qu'un
  // produit ajouté depuis Scan n'apparaîtrait qu'après un tirer-pour-
  // rafraîchir. `recharger` a une identité stable, donc pas de boucle.
  const rechargerAuFocus = useCallback(() => { recharger(); }, [recharger]);
  useFocusEffect(rechargerAuFocus);

  const sections = useMemo(
    () => organiserCatalogue(produits, requete, tri),
    [produits, requete, tri],
  );

  // La fiche ouverte doit refléter le produit rechargé, pas celui capturé à
  // l'ouverture : sans quoi l'étoile ne changerait pas après une bascule.
  const ouvertFrais = ouvert ? produits.find((p) => p.id === ouvert.id) ?? ouvert : null;

  if (chargement && produits.length === 0) {
    return <SafeAreaView style={s.centre}><ActivityIndicator color={colors.accent} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.ecran}>
      <View style={s.entete}>
        <Text style={s.titre}>Produits</Text>
        <Text style={s.compte}>{produits.length}</Text>
      </View>

      <View style={s.recherche}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={s.champ}
          value={requete}
          onChangeText={setRequete}
          placeholder="Chercher un produit"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <View style={s.tris}>
        {TRIS.map((t) => (
          <Pressable
            key={t.cle}
            style={[s.tri, tri === t.cle && s.triActif]}
            onPress={() => setTri(t.cle)}
          >
            <Text style={[s.triTexte, tri === t.cle && s.triTexteActif]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {erreur && (
        <View style={s.erreur}>
          {/* `erreur` est déjà une phrase française destinée à l'utilisateur. */}
          <Text style={s.erreurTexte}>{erreur}</Text>
          <Pressable onPress={recharger}><Text style={s.reessayer}>Réessayer</Text></Pressable>
        </View>
      )}

      <SectionList
        sections={sections.map((x) => ({ titre: x.titre, data: x.produits }))}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => setOuvert(item)}>
            <ProductRow produit={item} />
          </Pressable>
        )}
        renderSectionHeader={({ section }) =>
          section.titre ? <Text style={s.rayon}>{section.titre}</Text> : null}
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={() => <View style={s.separateur} />}
        contentContainerStyle={sections.length === 0 ? s.videConteneur : s.liste}
        refreshControl={
          <RefreshControl refreshing={chargement} onRefresh={recharger} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          erreur ? null : (
            <EtatVide titre={requete ? 'Aucun résultat' : 'Aucun produit'}>
              {requete
                ? 'Aucun produit ne porte ce nom. Essaie avec moins de mots.'
                : 'Scanne un code-barres : les produits arriveront ici.'}
            </EtatVide>
          )
        }
      />

      <DetailProduit
        produit={ouvertFrais}
        onFermer={() => setOuvert(null)}
        onChange={recharger}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  entete: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md,
  },
  titre: { fontSize: 26, fontWeight: '700', color: colors.text },
  compte: { fontSize: 15, color: colors.textMuted },

  recherche: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, paddingHorizontal: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.pill, height: 40,
  },
  champ: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },

  tris: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tri: {
    borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  triActif: { backgroundColor: colors.accent },
  triTexte: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  triTexteActif: { color: colors.accentContrast },

  liste: { paddingBottom: spacing.xxl },
  videConteneur: { flexGrow: 1, justifyContent: 'center' },
  rayon: {
    ...texte.section, fontSize: 13, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6,
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  separateur: { height: 1, backgroundColor: colors.bg },
  erreur: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  erreurTexte: { color: colors.danger, fontSize: 14 },
  reessayer: { color: colors.accent, fontWeight: '700', fontSize: 14 },
});
