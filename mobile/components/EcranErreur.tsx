import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ErrorBoundaryProps } from 'expo-router';
import { colors, radius, spacing } from '../lib/theme';

/**
 * Filet posé sous les écrans : une erreur de rendu affiche son message au
 * lieu de tuer l'application.
 *
 * Sans lui, une exception non rattrapée sous Hermes termine le processus :
 * l'application « se ferme », sans que rien n'indique pourquoi. C'est ce qui
 * arrivait en ouvrant le suivi, et c'est ce qui rendait le diagnostic
 * impossible à distance.
 *
 * Le message technique est montré délibérément. La règle du projet — aucun
 * code technique à l'écran — vaut pour les erreurs prévues, celles qui ont un
 * texte en français. Ici il n'y en a pas : cacher le message ne laisserait
 * qu'un écran vide, ce qui n'aide personne.
 */
export function EcranErreur({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaView style={s.ecran}>
      <ScrollView contentContainerStyle={s.corps}>
        <Text style={s.titre}>Cet écran n&apos;a pas pu s&apos;afficher</Text>
        <Text style={s.aide}>
          L&apos;application reste ouverte. Recopie le message ci-dessous, il dit exactement
          ce qui a échoué.
        </Text>

        <View style={s.cadre}>
          <Text style={s.message} selectable>
            {error?.message ?? 'Erreur sans message'}
          </Text>
          {error?.stack ? (
            <Text style={s.pile} selectable numberOfLines={12}>
              {error.stack}
            </Text>
          ) : null}
        </View>

        <Pressable style={s.bouton} onPress={retry}>
          <Text style={s.boutonTexte}>Réessayer</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  corps: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  titre: { fontSize: 20, fontWeight: '800', color: colors.text },
  aide: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  cadre: {
    backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger,
    borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm,
  },
  message: { fontSize: 14, fontWeight: '700', color: colors.danger },
  pile: { fontSize: 11, color: colors.text, lineHeight: 15 },
  bouton: {
    backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.lg,
    alignItems: 'center', marginTop: spacing.md,
  },
  boutonTexte: { color: colors.accentContrast, fontWeight: '700', fontSize: 16 },
});
