import { useEffect } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Updates from 'expo-updates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../lib/theme';

/** Télécharge une mise à jour publiée, sans l'appliquer : redémarrer reste un choix. */
async function telechargerSiDisponible() {
  if (__DEV__ || !Updates.isEnabled) return;
  try {
    const r = await Updates.checkForUpdateAsync();
    if (r.isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    // Hors ligne ou serveur injoignable : on réessaiera au prochain retour dans l'app.
  }
}

/**
 * Bandeau « nouvelle version », posé en haut de tous les écrans.
 *
 * La mise à jour (Expo Updates) se télécharge en arrière-plan au lancement et
 * à chaque retour au premier plan. Le bandeau n'apparaît qu'une fois prête :
 * l'appliquer d'office relancerait l'app au milieu d'une liste de courses.
 */
export function BandeauMiseAJour() {
  const { isUpdatePending } = Updates.useUpdates();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    telechargerSiDisponible();
    const sub = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') telechargerSiDisponible();
    });
    return () => sub.remove();
  }, []);

  if (__DEV__ || !Updates.isEnabled || !isUpdatePending) return null;

  return (
    <View pointerEvents="box-none" style={[s.conteneur, { top: insets.top + spacing.sm }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nouvelle version prête. Touche pour redémarrer l'application."
        style={({ pressed }) => [s.bandeau, pressed && s.presse]}
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          Updates.reloadAsync().catch(() => {});
        }}
      >
        <Feather name="refresh-cw" size={16} color={colors.accentContrast} />
        <Text style={s.texte} numberOfLines={1}>Nouvelle version prête</Text>
        <Text style={s.action}>Redémarrer</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  conteneur: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  bandeau: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  presse: { opacity: 0.85 },
  texte: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.accentContrast },
  action: { fontSize: 13, fontWeight: '700', color: colors.accentContrast, textDecorationLine: 'underline' },
});
