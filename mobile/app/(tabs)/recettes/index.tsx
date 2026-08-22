import { useCallback } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { EtatVide } from '../../../components/EtatVide';
import { useRecipes, type Recipe } from '../../../stores/recipes';
import { colors, radius, spacing } from '../../../lib/theme';

/**
 * Ligne non cliquable : il n'existe pas d'écran de détail, l'édition étant
 * hors périmètre de ce lot. Une ligne qui réagit au toucher sans rien ouvrir
 * est pire qu'une ligne inerte.
 */
function LigneRecette({ recette }: { recette: Recipe }) {
  const n = recette.ingredients.length;
  return (
    <View style={s.ligne}>
      <View style={s.texte}>
        <Text style={s.nom} numberOfLines={1}>{recette.name}</Text>
        <Text style={s.detail}>
          {`${recette.servings_default} parts · ${n} ingrédient${n > 1 ? 's' : ''}`}
        </Text>
      </View>
    </View>
  );
}

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
          <LigneRecette recette={item} />
        )}
        ItemSeparatorComponent={() => <View style={s.separateur} />}
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
        contentContainerStyle={recettes.length === 0 ? s.videConteneur : undefined}
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
  ligne: {
    paddingVertical: spacing.lg, paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  texte: { gap: 2 },
  nom: { fontSize: 15, fontWeight: '600', color: colors.text },
  detail: { fontSize: 13, color: colors.textMuted },
  separateur: { height: 1, backgroundColor: colors.border },
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
