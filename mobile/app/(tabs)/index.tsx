import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProductRow } from '../../components/ProductRow';
import { EtatVide } from '../../components/EtatVide';
import { useProducts } from '../../stores/products';
import { colors, spacing } from '../../lib/theme';

export default function Produits() {
  const { produits, chargement, erreur, recharger } = useProducts();

  if (chargement && produits.length === 0) {
    return (
      <SafeAreaView style={s.centre}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.ecran}>
      <View style={s.entete}>
        <Text style={s.titre}>Produits</Text>
        <Text style={s.compte}>{produits.length}</Text>
      </View>

      {erreur && (
        <View style={s.erreur}>
          <Text style={s.erreurTexte}>Impossible de charger le catalogue.</Text>
          <Text style={s.erreurDetail}>{erreur}</Text>
          <Pressable onPress={recharger}><Text style={s.reessayer}>Réessayer</Text></Pressable>
        </View>
      )}

      <FlatList
        data={produits}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <ProductRow produit={item} />}
        ItemSeparatorComponent={() => <View style={s.separateur} />}
        refreshControl={
          <RefreshControl refreshing={chargement} onRefresh={recharger} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          erreur ? null : (
            <EtatVide titre="Aucun produit">
              Scanne un code-barres pour ajouter ton premier produit.
            </EtatVide>
          )
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  entete: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    padding: spacing.lg,
  },
  titre: { fontSize: 26, fontWeight: '800', color: colors.text },
  compte: { fontSize: 15, color: colors.textMuted },
  separateur: { height: 1, backgroundColor: colors.border, marginLeft: 76 },
  erreur: {
    margin: spacing.lg, padding: spacing.lg, borderRadius: 10,
    borderWidth: 1, borderColor: colors.danger, gap: spacing.xs,
  },
  erreurTexte: { color: colors.text, fontWeight: '600' },
  erreurDetail: { color: colors.textMuted, fontSize: 12 },
  reessayer: { color: colors.accent, fontWeight: '700', marginTop: spacing.sm },
});
