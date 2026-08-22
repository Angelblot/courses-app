import { ScrollView, StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { PileSwipe } from './PileSwipe';
import { EtatVide } from '../EtatVide';
import { useWizard } from '../../contexts/WizardContext';
import { useRecipes, type Recipe } from '../../stores/recipes';
import { colors, radius, spacing } from '../../lib/theme';

function CarteRecette({ recette }: { recette: Recipe }) {
  const n = recette.ingredients.length;
  return (
    <View style={s.carte}>
      <Text style={s.carteTitre} numberOfLines={2}>{recette.name}</Text>
      <Text style={s.carteDetail}>
        {`${recette.servings_default} parts · ${n} ingrédient${n > 1 ? 's' : ''}`}
      </Text>
      <Text style={s.consigne}>Glisse à droite pour la retenir</Text>
    </View>
  );
}

export function EtapeRecettes() {
  const { recettes, chargement } = useRecipes();
  const w = useWizard();
  const router = useRouter();

  if (chargement && recettes.length === 0) {
    return <View style={s.centre}><ActivityIndicator color={colors.accent} /></View>;
  }

  if (recettes.length === 0) {
    return (
      <View style={s.centre}>
        <EtatVide titre="Aucune recette">
          Le wizard compose ta liste à partir de tes recettes. Crée-en une pour commencer.
        </EtatVide>
        <Pressable style={s.lien} onPress={() => router.push('/recettes/nouvelle')}>
          <Text style={s.lienTexte}>Créer une recette</Text>
        </Pressable>
      </View>
    );
  }

  const retenues = recettes.filter((r) => w.selectedRecipes[r.id] != null);

  return (
    <View style={s.bloc}>
      <View style={s.pile}>
        <PileSwipe
          items={recettes}
          getId={(r) => r.id}
          onAccepter={(r) => w.toggleRecette(r.id, r.servings_default)}
          onRejeter={() => {}}
          rendreCarte={(r) => <CarteRecette recette={r} />}
          etatVide={<EtatVide titre="Tu as vu toutes tes recettes." />}
        />
      </View>

      {retenues.length > 0 && (
        <ScrollView style={s.liste} contentContainerStyle={s.listeContenu}>
          <Text style={s.sousTitre}>{`Retenues (${retenues.length})`}</Text>
          {retenues.map((r) => (
            <View key={r.id} style={s.ligne}>
              <Text style={s.ligneNom} numberOfLines={1}>{r.name}</Text>
              <View style={s.parts}>
                <Pressable
                  style={s.pas}
                  onPress={() => w.setParts(r.id, w.selectedRecipes[r.id] - 1)}
                  hitSlop={6}
                >
                  <Text style={s.pasTexte}>−</Text>
                </Pressable>
                <Text style={s.partsTexte}>{`${w.selectedRecipes[r.id]} parts`}</Text>
                <Pressable
                  style={s.pas}
                  onPress={() => w.setParts(r.id, w.selectedRecipes[r.id] + 1)}
                  hitSlop={6}
                >
                  <Text style={s.pasTexte}>+</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bloc: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  pile: { height: 240, marginHorizontal: spacing.lg },
  carte: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, minHeight: 200,
    justifyContent: 'center',
  },
  carteTitre: { fontSize: 22, fontWeight: '800', color: colors.text },
  carteDetail: { fontSize: 15, color: colors.textMuted },
  consigne: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md },
  liste: { flex: 1, marginTop: spacing.lg },
  listeContenu: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.lg },
  sousTitre: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  ligne: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md,
  },
  ligneNom: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  parts: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pas: {
    width: 28, height: 28, borderRadius: radius.pill, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  pasTexte: { fontSize: 16, fontWeight: '700', color: colors.text },
  partsTexte: { fontSize: 13, color: colors.textMuted, minWidth: 56, textAlign: 'center' },
  lien: {
    borderWidth: 1, borderColor: colors.accent, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
  },
  lienTexte: { color: colors.accent, fontWeight: '700', fontSize: 15 },
});
