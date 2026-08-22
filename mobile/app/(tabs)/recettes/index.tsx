import { useCallback } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { CarteRecette } from '../../../components/CarteRecette';
import { EtatVide } from '../../../components/EtatVide';
import { useRecipes, type Recipe } from '../../../stores/recipes';
import { colors, radius, spacing } from '../../../lib/theme';

export default function Recettes() {
  const { recettes, chargement, erreur, recharger } = useRecipes();
  const router = useRouter();

  // Même raison que pour le catalogue : `<Tabs>` garde les écrans montés, donc
  // une recette créée n'apparaîtrait pas au retour sans ce rechargement.
  const rechargerAuFocus = useCallback(() => { recharger(); }, [recharger]);
  useFocusEffect(rechargerAuFocus);

  if (chargement && recettes.length === 0) {
    return (
      <SafeAreaView style={s.centre}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.ecran}>
      <View style={s.entete}>
        <Text style={s.titre}>Recettes</Text>
        <Text style={s.compte}>{recettes.length}</Text>
      </View>

      {erreur && (
        <View style={s.erreur}>
          <Text style={s.erreurTexte}>{erreur}</Text>
          <Pressable style={s.reessayer} onPress={recharger}>
            <Text style={s.reessayerTexte}>Réessayer</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={recettes}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <CarteRecette recette={item} onOuvrir={() => router.push(`/recettes/${item.id}`)} />
        )}
        ItemSeparatorComponent={() => <View style={s.espace} />}
        contentContainerStyle={recettes.length === 0 ? s.videConteneur : s.grille}
        refreshControl={
          <RefreshControl refreshing={chargement} onRefresh={recharger} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          erreur ? null : (
            <EtatVide titre="Aucune recette">
              Crée ta première recette : le wizard s&apos;en servira pour composer ta liste.
            </EtatVide>
          )
        }
      />

      <Pressable style={s.bouton} onPress={() => router.push('/recettes/nouvelle')}>
        <Text style={s.boutonTexte}>Nouvelle recette</Text>
      </Pressable>
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
  titre: { fontSize: 26, fontWeight: '800', color: colors.text },
  compte: { fontSize: 15, color: colors.textMuted },
  espace: { height: spacing.lg },
  grille: { padding: spacing.lg },
  videConteneur: { flexGrow: 1, justifyContent: 'center' },
  erreur: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  erreurTexte: { color: colors.danger, fontSize: 14 },
  reessayer: {
    alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
  },
  reessayerTexte: { color: colors.text, fontWeight: '600', fontSize: 14 },
  bouton: {
    margin: spacing.lg, backgroundColor: colors.accent, borderRadius: radius.md,
    padding: spacing.lg, alignItems: 'center',
  },
  boutonTexte: { color: colors.accentContrast, fontWeight: '700', fontSize: 16 },
});
