import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { EtatVide } from '../../../../components/EtatVide';
import { useRecette } from '../../../../stores/recipes';
import { useProducts } from '../../../../stores/products';
import { quantitePourParts, initiale, indiceAplat } from '../../../../lib/recettes-affichage.ts';
import { formatIngredientQty } from '../../../../lib/unites.ts';
import { colors, radius, spacing } from '../../../../lib/theme';

export default function DetailRecette() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { recette, chargement, erreur, recharger } = useRecette(id);
  const { produits } = useProducts();
  // Le réglage n'est qu'une aide à la lecture : il repart de la valeur
  // enregistrée à chaque ouverture et ne modifie jamais la recette.
  const [parts, setParts] = useState<number | null>(null);

  const rechargerAuFocus = useCallback(() => { recharger(); }, [recharger]);
  useFocusEffect(rechargerAuFocus);

  if (chargement && !recette) {
    return <SafeAreaView style={s.centre}><ActivityIndicator color={colors.accent} /></SafeAreaView>;
  }

  if (erreur) {
    return (
      <SafeAreaView style={s.centre}>
        <Text style={s.erreur}>{erreur}</Text>
        <Pressable style={s.reessayer} onPress={recharger}>
          <Text style={s.reessayerTexte}>Réessayer</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!recette) {
    return (
      <SafeAreaView style={s.centre}>
        <EtatVide titre="Recette introuvable">
          Elle a peut-être été supprimée depuis un autre appareil.
        </EtatVide>
      </SafeAreaView>
    );
  }

  const n = parts ?? recette.servings_default;

  return (
    <View style={s.ecran}>
      <ScrollView contentContainerStyle={s.corps}>
        <View>
          {recette.image_url ? (
            <Image source={{ uri: recette.image_url }} style={s.bandeau} resizeMode="cover" />
          ) : (
            <View style={[s.bandeau, s.aplat, { backgroundColor: colors.aplats[indiceAplat(recette.name)] }]}>
              <Text style={s.initiale}>{initiale(recette.name)}</Text>
            </View>
          )}
          <SafeAreaView style={s.barre} edges={['top']}>
            <Pressable style={s.rond} onPress={() => router.back()} hitSlop={8}>
              <Feather name="arrow-left" size={20} color={colors.text} />
            </Pressable>
            <Pressable
              style={s.rond}
              onPress={() => router.push(`/recettes/${recette.id}/modifier`)}
              hitSlop={8}
            >
              <Feather name="edit-2" size={18} color={colors.text} />
            </Pressable>
          </SafeAreaView>
        </View>

        <View style={s.texte}>
          <Text style={s.titre}>{recette.name}</Text>
          {recette.description && <Text style={s.description}>{recette.description}</Text>}

          <View style={s.reglage}>
            <Text style={s.reglageLabel}>Pour</Text>
            <View style={s.compteur}>
              <Pressable style={s.pas} onPress={() => setParts(Math.max(1, n - 1))} hitSlop={6}>
                <Text style={s.pasTexte}>−</Text>
              </Pressable>
              <Text style={s.compteurTexte}>{`${n} parts`}</Text>
              <Pressable style={s.pas} onPress={() => setParts(n + 1)} hitSlop={6}>
                <Text style={s.pasTexte}>+</Text>
              </Pressable>
            </View>
          </View>

          <Text style={s.section}>Ingrédients</Text>
          {recette.ingredients.map((ing) => {
            const produit = ing.product_id
              ? produits.find((p) => p.id === ing.product_id)
              : null;
            return (
              <View key={ing.id} style={s.ligne}>
                {produit?.image_url
                  ? <Image source={{ uri: produit.image_url }} style={s.vignette} resizeMode="contain" />
                  : <View style={[s.vignette, s.vignetteVide]} />}
                <View style={s.ligneTexte}>
                  <Text style={s.ligneNom} numberOfLines={2}>{ing.name}</Text>
                  {!ing.product_id && (
                    <Text style={s.nonRattache}>
                      Non rattaché · l&apos;extension devra le chercher par son nom.
                    </Text>
                  )}
                </View>
                <Text style={s.quantite}>
                  {formatIngredientQty(quantitePourParts(ing.quantity_per_serving, n), ing.unit)}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  centre: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg, gap: spacing.md, padding: spacing.xl,
  },
  corps: { paddingBottom: spacing.xxl },
  bandeau: { height: 220, width: '100%', backgroundColor: colors.bg },
  aplat: { alignItems: 'center', justifyContent: 'center' },
  initiale: { fontSize: 64, fontWeight: '800', color: '#FFFFFF' },
  barre: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  rond: {
    width: 36, height: 36, borderRadius: radius.pill,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.sm,
  },
  texte: { padding: spacing.lg, gap: spacing.sm },
  titre: { fontSize: 26, fontWeight: '800', color: colors.text },
  description: { fontSize: 15, color: colors.textMuted, lineHeight: 21 },
  reglage: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.md, backgroundColor: colors.surface,
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  reglageLabel: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  compteur: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pas: {
    width: 30, height: 30, borderRadius: radius.pill, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  pasTexte: { fontSize: 17, fontWeight: '700', color: colors.text },
  compteurTexte: { fontSize: 15, fontWeight: '600', color: colors.text, minWidth: 62, textAlign: 'center' },
  section: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing.lg },
  ligne: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
  },
  vignette: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.bg },
  vignetteVide: { borderWidth: 1, borderColor: colors.border },
  ligneTexte: { flex: 1, gap: 2 },
  ligneNom: { fontSize: 15, fontWeight: '600', color: colors.text },
  nonRattache: { fontSize: 11, color: colors.textMuted },
  quantite: { fontSize: 14, fontWeight: '700', color: colors.text },
  erreur: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  reessayer: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
  },
  reessayerTexte: { color: colors.text, fontWeight: '600', fontSize: 14 },
});
