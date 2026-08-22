import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { EtatVide } from '../EtatVide';
import { useWizard } from '../../contexts/WizardContext';
import { useRecipes } from '../../stores/recipes';
import { useProducts } from '../../stores/products';
import { buildConsolidatedItems, groupByRayon } from '../../lib/consolidation.ts';
import { formatIngredientQty } from '../../lib/unites.ts';
import { libelleRayon } from '../../lib/rayons.ts';
import { colors, radius, spacing } from '../../lib/theme';

export function EtapeRecap() {
  const { recettes } = useRecipes();
  const { produits } = useProducts();
  const w = useWizard();

  const groupes = useMemo(() => {
    const lignes = buildConsolidatedItems({
      recipes: recettes,
      selectedRecipes: w.selectedRecipes,
      quotidien: w.quotidien,
      quotidienQty: w.quotidienQty,
      extras: w.extras,
      products: produits,
    });
    return groupByRayon(lignes);
  }, [recettes, produits, w.selectedRecipes, w.quotidien, w.quotidienQty, w.extras]);

  const total = groupes.reduce((n, g) => n + g.entries.length, 0);

  if (total === 0) {
    return (
      <View style={s.centre}>
        <EtatVide titre="Ta liste est vide">
          Retiens des recettes ou marque des produits du quotidien aux étapes précédentes.
        </EtatVide>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.contenu}>
      <Text style={s.total}>{`${total} article${total > 1 ? 's' : ''}`}</Text>

      {groupes.map((g) => (
        <View key={g.rayon} style={s.rayon}>
          {/* Le libellé, jamais la clé : « Produits laitiers », pas « pls ». */}
          <Text style={s.rayonTitre}>{libelleRayon(g.rayon)}</Text>
          {g.entries.map((ligne) => {
            const provenance = [...new Set(ligne.sources.map((x) => x.label))].join(', ');
            return (
              <View key={ligne.key} style={s.ligne}>
                <View style={s.ligneTexte}>
                  <Text style={s.nom} numberOfLines={2}>{ligne.name}</Text>
                  <Text style={s.provenance} numberOfLines={1}>{provenance}</Text>
                </View>
                <Text style={s.quantite}>
                  {formatIngredientQty(ligne.totalQuantity, ligne.unit)}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contenu: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  total: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  rayon: { gap: spacing.xs },
  rayonTitre: {
    fontSize: 13, fontWeight: '800', color: colors.accent,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.xs,
  },
  ligne: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md,
  },
  ligneTexte: { flex: 1, gap: 2 },
  nom: { fontSize: 15, fontWeight: '600', color: colors.text },
  provenance: { fontSize: 12, color: colors.textMuted },
  quantite: { fontSize: 14, fontWeight: '700', color: colors.text },
});
