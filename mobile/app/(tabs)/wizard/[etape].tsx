import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ETAPES, useWizard, type CleEtape } from '../../../contexts/WizardContext';
import { EtapeRecettes } from '../../../components/wizard/EtapeRecettes';
import { EtapeQuotidien } from '../../../components/wizard/EtapeQuotidien';
import { EtapeIngredients } from '../../../components/wizard/EtapeIngredients';
import { EtapeRecap } from '../../../components/wizard/EtapeRecap';
import { EtapeGeneration } from '../../../components/wizard/EtapeGeneration';
import { colors, radius, spacing } from '../../../lib/theme';

export default function EtapeWizard() {
  const { etape } = useLocalSearchParams<{ etape?: string }>();
  const router = useRouter();
  const w = useWizard();

  const index = ETAPES.findIndex((e) => e.cle === etape);
  const courante = index >= 0 ? ETAPES[index] : null;

  // Le bouton d'action n'apparaît que lorsque l'étape a de quoi continuer :
  // un bouton visible mais sans effet apprend à l'utilisateur à s'en méfier.
  const peutContinuer = useMemo(() => {
    switch (courante?.cle as CleEtape | undefined) {
      case 'recettes':
        return true;
      case 'quotidien':
        return Object.values(w.quotidien).some((v) => v === 'needed') || w.extras.length > 0;
      case 'ingredients':
        return true;
      case 'recap':
        return Object.keys(w.selectedRecipes).length > 0
          || Object.values(w.quotidien).some((v) => v === 'needed')
          || w.extras.length > 0;
      case 'generation':
        return w.drives.length > 0;
      default:
        return false;
    }
  }, [courante, w.quotidien, w.extras, w.selectedRecipes, w.drives]);

  // Étape inconnue : on ramène au début plutôt que d'afficher un écran muet.
  if (index < 0 || !courante) return <Redirect href="/wizard/recettes" />;

  const dernier = index === ETAPES.length - 1;

  const suivant = () => {
    if (dernier) return;
    router.push(`/wizard/${ETAPES[index + 1].cle}`);
  };

  const quitter = () => {
    w.reinitialiser();
    router.replace('/');
  };

  return (
    <SafeAreaView style={s.ecran}>
      <View style={s.haut}>
        <View style={s.progression}>
          {ETAPES.map((e, i) => (
            <View key={e.cle} style={[s.segment, i <= index && s.segmentActif]} />
          ))}
        </View>
        <Pressable onPress={quitter} hitSlop={10} style={s.quitter}>
          <Feather name="x" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={s.meta}>
        <Text style={s.compte}>{`Étape ${index + 1}/${ETAPES.length}`}</Text>
        <Text style={s.titre}>{courante.titre}</Text>
      </View>

      <View style={s.contenu}>
        {courante.cle === 'recettes' && <EtapeRecettes />}
        {courante.cle === 'quotidien' && <EtapeQuotidien />}
        {courante.cle === 'ingredients' && <EtapeIngredients />}
        {courante.cle === 'recap' && <EtapeRecap />}
        {courante.cle === 'generation' && <EtapeGeneration />}
      </View>

      {!dernier && peutContinuer && (
        <Pressable style={s.bouton} onPress={suivant}>
          <Text style={s.boutonTexte}>Continuer</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  haut: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
  },
  progression: { flex: 1, flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: 3, borderRadius: radius.pill, backgroundColor: colors.border },
  segmentActif: { backgroundColor: colors.accent },
  quitter: { padding: spacing.xs },
  meta: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 2 },
  compte: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  titre: { fontSize: 22, fontWeight: '800', color: colors.text },
  contenu: { flex: 1, paddingTop: spacing.md },
  bouton: {
    margin: spacing.lg, backgroundColor: colors.accent, borderRadius: radius.md,
    padding: spacing.lg, alignItems: 'center',
  },
  boutonTexte: { color: colors.accentContrast, fontWeight: '700', fontSize: 16 },
});
