import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EtatVide } from '../EtatVide';
import { useWizard } from '../../contexts/WizardContext';
import { useRecipes } from '../../stores/recipes';
import { useProducts } from '../../stores/products';
import { getRecipeIngredientMatches } from '../../lib/consolidation.ts';
import { formatIngredientQty } from '../../lib/unites.ts';
import { colors, radius, spacing } from '../../lib/theme';

export function EtapeIngredients() {
  const { recettes } = useRecipes();
  const { produits } = useProducts();
  const w = useWizard();

  const groupes = useMemo(
    () => getRecipeIngredientMatches({
      selectedRecipes: w.selectedRecipes,
      recipes: recettes,
      products: produits,
    }),
    [w.selectedRecipes, recettes, produits],
  );

  if (groupes.length === 0) {
    return (
      <View style={s.centre}>
        <EtatVide titre="Aucun ingrédient">
          Retiens au moins une recette à l&apos;étape précédente.
        </EtatVide>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.contenu}>
      {groupes.map((g) => {
        const retenu = w.choixProduits[g.key] ?? g.matchingProducts[0]?.id ?? null;
        const recettes_ = [...new Set(g.sources.map((x) => x.recipeName))].join(', ');

        return (
          <View key={g.key} style={s.carte}>
            <View style={s.entete}>
              <Text style={s.nom} numberOfLines={1}>{g.ingredientName}</Text>
              <Text style={s.quantite}>{formatIngredientQty(g.totalQty, g.unit)}</Text>
            </View>
            <Text style={s.provenance} numberOfLines={1}>{recettes_}</Text>

            {g.matchingProducts.length === 0 ? (
              // Ce cas doit se voir : c'est celui où l'extension devra deviner
              // à partir du seul libellé, avec le risque d'ambiguïté connu.
              <Text style={s.aucun}>
                Aucun produit de ton catalogue ne correspond. Il partira sous son nom générique.
              </Text>
            ) : g.matchingProducts.length === 1 ? (
              <Text style={s.unique}>{g.matchingProducts[0].name}</Text>
            ) : (
              <View style={s.candidats}>
                {g.matchingProducts.map((p) => {
                  const actif = p.id === retenu;
                  return (
                    <Pressable
                      key={p.id}
                      style={[s.candidat, actif && s.candidatActif]}
                      onPress={() => w.choisirProduit(g.key, p.id)}
                    >
                      <Text
                        style={[s.candidatTexte, actif && s.candidatTexteActif]}
                        numberOfLines={2}
                      >
                        {p.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contenu: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  carte: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs,
  },
  entete: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between', gap: spacing.md,
  },
  nom: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  quantite: { fontSize: 14, fontWeight: '600', color: colors.accent },
  provenance: { fontSize: 12, color: colors.textMuted },
  aucun: { fontSize: 13, color: colors.danger, marginTop: spacing.sm, lineHeight: 18 },
  unique: { fontSize: 14, color: colors.text, marginTop: spacing.sm },
  candidats: { gap: spacing.xs, marginTop: spacing.sm },
  candidat: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  candidatActif: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  candidatTexte: { fontSize: 14, color: colors.text },
  candidatTexteActif: { fontWeight: '700', color: colors.accent },
});
