import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EtatVide } from '../../../components/EtatVide';
import { useSuiviTravail, useTravailActif } from '../../../stores/suivi';
import { libelleEtat, libelleDrive, resume } from '../../../lib/suivi-libelles.ts';
import { estClos } from '../../../lib/suivi-bandeau.ts';
import { colors, radius, spacing } from '../../../lib/theme';

export default function SuiviTravail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { travail, chargement } = useSuiviTravail(id ?? null);
  const { acquitte } = useTravailActif();

  // Ouvrir le bilan d'un travail clos l'acquitte : c'est ce geste qui fait
  // disparaître le bandeau. Un travail encore en cours n'est pas acquitté —
  // il reste à signaler tant qu'il tourne.
  useEffect(() => {
    if (travail && estClos(travail.status)) acquitte(travail.id);
  }, [travail, acquitte]);

  if (chargement && !travail) {
    return <SafeAreaView style={s.centre}><ActivityIndicator color={colors.accent} /></SafeAreaView>;
  }

  if (!travail) {
    return (
      <SafeAreaView style={s.centre}>
        <EtatVide titre="Suivi introuvable">
          Ce remplissage n&apos;existe plus, ou appartient à un autre compte.
        </EtatVide>
        <Pressable style={s.bouton} onPress={() => router.replace('/')}>
          <Text style={s.boutonTexte}>Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const bilan = travail.results ?? null;
  const manquants = bilan
    ? Object.entries(bilan).flatMap(([drive, lignes]) =>
        (lignes ?? []).filter((l) => !l.ok).map((l) => ({ drive, ...l })))
    : [];

  return (
    <SafeAreaView style={s.ecran}>
      <ScrollView contentContainerStyle={s.corps}>
        <Text style={s.titre}>{libelleEtat(travail.status)}</Text>
        <Text style={s.resume}>{resume(travail)}</Text>

        {manquants.length > 0 && (
          <View style={s.manquants}>
            <Text style={s.manquantsTitre}>
              {`${manquants.length} produit${manquants.length > 1 ? 's' : ''} non ajouté${manquants.length > 1 ? 's' : ''}`}
            </Text>
            {manquants.map((m, i) => (
              <Text key={`${m.drive}-${i}`} style={s.manquant} numberOfLines={2}>
                {`${m.item} — ${libelleDrive(m.drive)}`}
              </Text>
            ))}
          </View>
        )}

        <Pressable style={s.bouton} onPress={() => router.replace('/')}>
          <Text style={s.boutonTexte}>Terminer</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  centre: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg, gap: spacing.md, padding: spacing.xl,
  },
  corps: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl, gap: spacing.sm,
  },
  titre: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  resume: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
  manquants: {
    alignSelf: 'stretch', marginTop: spacing.lg, gap: spacing.xs,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.lg,
  },
  manquantsTitre: { fontSize: 13, fontWeight: '700', color: colors.danger },
  manquant: { fontSize: 14, color: colors.text },
  bouton: {
    backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.lg,
    alignItems: 'center', marginTop: spacing.lg, alignSelf: 'stretch',
  },
  boutonTexte: { color: colors.accentContrast, fontWeight: '700', fontSize: 16 },
});
